const axios = require('axios');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Models are tried in order. If one is retired / unavailable, the next one is used automatically.
// Groq retired llama-3.3-70b-versatile on 2026-08-16 (recommended: openai/gpt-oss-120b or qwen/qwen3.6-27b).
const DEFAULT_MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b'];

// Models Groq has shut down. If one of these is still set in GROQ_MODEL (e.g. on Render),
// it is ignored so it can't break analysis.
const RETIRED_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'qwen/qwen3-32b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'moonshotai/kimi-k2-instruct-0905',
  'deepseek-r1-distill-llama-70b',
  'gemma2-9b-it'
]);

const MAX_RESUME_CHARS = 12000;

class GroqError extends Error {
  constructor(message, kind, status) {
    super(message);
    this.name = 'GroqError';
    this.kind = kind; // 'auth' | 'rate_limit' | 'model' | 'bad_response' | 'network' | 'other'
    this.status = status;
  }
}

function getModels() {
  // GROQ_MODEL can be one model or a comma-separated list
  const configured = (process.env.GROQ_MODEL || '')
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m && !RETIRED_MODELS.has(m));
  const all = [...configured, ...DEFAULT_MODELS];
  return [...new Set(all)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Turn an axios error into a GroqError with a readable message
function classifyError(err) {
  if (err instanceof GroqError) return err;

  if (err.response) {
    const status = err.response.status;
    const apiMsg = err.response.data?.error?.message || '';
    const apiCode = err.response.data?.error?.code || '';
    const lower = `${apiMsg} ${apiCode}`.toLowerCase();

    if (status === 401 || status === 403) {
      return new GroqError('Groq rejected the API key. Please save a valid key in Settings.', 'auth', status);
    }
    if (
      status === 404 ||
      lower.includes('model_not_found') ||
      lower.includes('decommissioned') ||
      lower.includes('does not exist') ||
      lower.includes('model_terms')
    ) {
      return new GroqError(`Model unavailable: ${apiMsg || 'not found'}`, 'model', status);
    }
    if (status === 429) {
      const retryAfter = Number(err.response.headers?.['retry-after']) || 0;
      const e = new GroqError(`Groq rate limit reached. ${apiMsg}`.trim(), 'rate_limit', status);
      e.retryAfter = retryAfter;
      return e;
    }
    return new GroqError(`Groq error (${status}): ${apiMsg || err.message}`, 'other', status);
  }

  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return new GroqError('Request to Groq timed out.', 'network');
  }
  return new GroqError(`Could not reach Groq: ${err.message}`, 'network');
}

// Pull a JSON object out of the model's reply, even if it has code fences or <think> blocks
function extractJson(content) {
  if (!content || typeof content !== 'string') throw new GroqError('Groq returned an empty response.', 'bad_response');
  let text = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(text);
  } catch (_) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (_) {
        /* fall through */
      }
    }
  }
  throw new GroqError('Groq returned a response that was not valid JSON.', 'bad_response');
}

const toStringArray = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);

// Validate + normalise the model's JSON so bad output can never corrupt the database
function normalizeResult(raw) {
  let score = raw?.atsScore ?? raw?.ats_score ?? raw?.score;
  score = typeof score === 'string' ? parseFloat(score) : score;
  if (typeof score !== 'number' || Number.isNaN(score)) {
    throw new GroqError('Groq response did not contain a numeric atsScore.', 'bad_response');
  }
  return {
    atsScore: Math.max(0, Math.min(100, Math.round(score))),
    matchedSkills: toStringArray(raw.matchedSkills),
    missingSkills: toStringArray(raw.missingSkills),
    suggestions: toStringArray(raw.suggestions)
  };
}

async function callGroq(apiKey, model, messages, { useJsonMode = true, maxTokens = 2500 } = {}) {
  const body = {
    model,
    messages,
    temperature: 0.2,
    max_completion_tokens: maxTokens
  };
  if (useJsonMode) body.response_format = { type: 'json_object' };
  // gpt-oss models are reasoning models: keep reasoning short so tokens aren't wasted
  if (model.includes('gpt-oss')) body.reasoning_effort = 'low';

  const response = await axios.post(GROQ_URL, body, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    timeout: 60000
  });
  return response.data?.choices?.[0]?.message?.content;
}

// Runs a request against the model list with fallback + retries. `handleContent` parses the reply.
async function runWithFallback(apiKey, messages, handleContent, opts = {}) {
  const models = getModels();
  let lastError;

  for (const model of models) {
    let useJsonMode = true;
    let attempts = 0;

    while (attempts < 3) {
      attempts++;
      try {
        const content = await callGroq(apiKey, model, messages, { useJsonMode, maxTokens: opts.maxTokens });
        return handleContent(content);
      } catch (rawErr) {
        // Some models reject response_format: retry once without it
        const status = rawErr.response?.status;
        const msg = (rawErr.response?.data?.error?.message || '').toLowerCase();
        if (useJsonMode && status === 400 && msg.includes('response_format')) {
          useJsonMode = false;
          attempts--;
          continue;
        }

        const err = classifyError(rawErr);
        lastError = err;

        if (err.kind === 'auth') throw err; // key is wrong - no point trying other models
        if (err.kind === 'model') break; // try the next model
        if (err.kind === 'rate_limit' && attempts < 3) {
          await sleep(Math.min((err.retryAfter || 5) * 1000, 20000));
          continue;
        }
        if (err.kind === 'bad_response' && attempts < 2) continue; // one retry for malformed JSON
        if (err.kind === 'network' && attempts < 2) {
          await sleep(1500);
          continue;
        }
        if (err.kind === 'rate_limit' || err.kind === 'bad_response' || err.kind === 'network' || err.kind === 'other') {
          break; // give up on this model, try the next one
        }
      }
    }
  }

  throw lastError || new GroqError('No Groq model could be used.', 'model');
}

/**
 * Scores a single candidate's resume against a drive's requirements/job description.
 * Used by recruiters when they click "Analyze Resumes" on a drive.
 */
async function scoreApplicationForDrive(apiKey, resumeText, drive) {
  const cleanedResume = String(resumeText || '')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_RESUME_CHARS);

  if (cleanedResume.length < 20) {
    throw new GroqError('No readable text was extracted from this resume.', 'bad_response');
  }

  const systemPrompt = `You are an expert technical recruiter and ATS (Applicant Tracking System) scoring engine.
Score how well the candidate's resume matches the role's requirements and job description.
Respond with ONLY valid JSON — no markdown, no code fences, no commentary — matching EXACTLY this schema:
{
  "atsScore": number between 0 and 100 (higher = better match),
  "matchedSkills": array of strings (skills/keywords from the requirements that the resume demonstrates),
  "missingSkills": array of strings (important skills/keywords from the requirements missing from the resume),
  "suggestions": array of strings (2-4 short, specific notes for the recruiter about this candidate's fit for THIS role)
}
Be honest, consistent, and base the score primarily on how well the resume's actual content overlaps with the stated requirements and job description. If the requirements are vague, judge against the role title and job description. Do not include any text outside the JSON object.`;

  const userPrompt = `COMPANY: ${drive.companyName}
ROLE / DRIVE: ${drive.driveTitle}
TYPE: ${drive.type === 'internship' ? 'Internship' : 'Full-time'}

REQUIREMENTS:
"""
${drive.requirements || 'No specific requirements listed.'}
"""

JOB DESCRIPTION:
"""
${drive.jobDescription || 'No job description provided.'}
"""

CANDIDATE RESUME:
"""
${cleanedResume}
"""`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  return runWithFallback(apiKey, messages, (content) => normalizeResult(extractJson(content)), { maxTokens: 2500 });
}

/**
 * Makes a tiny real completion so "Test Key" verifies the key AND that a working model is available.
 * Returns the model that worked.
 */
async function testGroqKey(apiKey) {
  const messages = [
    { role: 'system', content: 'Reply with only this JSON: {"ok": true}' },
    { role: 'user', content: 'ping' }
  ];
  const models = getModels();
  let lastError;
  for (const model of models) {
    try {
      await callGroq(apiKey, model, messages, { useJsonMode: true, maxTokens: 200 });
      return model;
    } catch (rawErr) {
      const err = classifyError(rawErr);
      lastError = err;
      if (err.kind === 'auth') throw err;
    }
  }
  throw lastError || new GroqError('No Groq model could be used.', 'model');
}

module.exports = { scoreApplicationForDrive, testGroqKey, GroqError, getModels, extractJson, normalizeResult };
