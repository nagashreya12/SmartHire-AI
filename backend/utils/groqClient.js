const axios = require('axios');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// You can swap this for any current Groq model, e.g. "llama-3.3-70b-versatile" or "openai/gpt-oss-120b"
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

/**
 * Scores a single candidate's resume against a drive's requirements/job description.
 * Used by recruiters when they click "Analyze Resumes" on a drive.
 */
async function scoreApplicationForDrive(apiKey, resumeText, drive) {
  const systemPrompt = `You are an expert technical recruiter and ATS (Applicant Tracking System) scoring engine.
Score how well the candidate's resume matches the role's requirements and job description.
Respond with ONLY valid JSON — no markdown, no code fences, no commentary — matching EXACTLY this schema:
{
  "atsScore": number between 0 and 100 (higher = better match),
  "matchedSkills": array of strings (skills/keywords from the requirements that the resume demonstrates),
  "missingSkills": array of strings (important skills/keywords from the requirements missing from the resume),
  "suggestions": array of strings (2-4 short, specific notes for the recruiter about this candidate's fit for THIS role)
}
Be honest, consistent, and base the score primarily on how well the resume's actual content overlaps with the stated requirements and job description. Do not include any text outside the JSON object.`;

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
${resumeText}
"""`;

  const response = await axios.post(
    GROQ_URL,
    {
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    }
  );

  const content = response.data.choices[0].message.content;
  return JSON.parse(content);
}

module.exports = { scoreApplicationForDrive };
