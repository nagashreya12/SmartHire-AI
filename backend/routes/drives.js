const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const Drive = require('../models/Drive');
const Application = require('../models/Application');
const User = require('../models/User');
const { decrypt } = require('../utils/crypto');
const { scoreApplicationForDrive } = require('../utils/groqClient');

// Create a new drive (recruiter only)
router.post('/', auth, requireRole('recruiter'), async (req, res) => {
  try {
    const { companyName, driveTitle, jobDescription, requirements, stipend, type } = req.body;
    if (!companyName || !driveTitle || !type) {
      return res.status(400).json({ message: 'companyName, driveTitle and type are required' });
    }
    if (!['internship', 'fulltime'].includes(type)) {
      return res.status(400).json({ message: 'type must be "internship" or "fulltime"' });
    }
    const drive = await Drive.create({
      recruiter: req.userId,
      companyName,
      driveTitle,
      jobDescription,
      requirements,
      stipend,
      type
    });
    res.status(201).json(drive);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// List all open drives (for students browsing)
router.get('/', auth, async (req, res) => {
  try {
    const drives = await Drive.find({ status: 'open' }).sort({ createdAt: -1 });
    res.json(drives);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// List drives created by the logged-in recruiter, with applicant counts
router.get('/my', auth, requireRole('recruiter'), async (req, res) => {
  try {
    const drives = await Drive.find({ recruiter: req.userId }).sort({ createdAt: -1 }).lean();
    const driveIds = drives.map((d) => d._id);
    const counts = await Application.aggregate([
      { $match: { drive: { $in: driveIds } } },
      { $group: { _id: '$drive', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    counts.forEach((c) => {
      countMap[c._id.toString()] = c.count;
    });
    const withCounts = drives.map((d) => ({ ...d, applicantCount: countMap[d._id.toString()] || 0 }));
    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a single drive (any authenticated user - used for the apply page too)
router.get('/:id', auth, async (req, res) => {
  try {
    const drive = await Drive.findById(req.params.id);
    if (!drive) return res.status(404).json({ message: 'Drive not found' });
    res.json(drive);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update a drive (owner recruiter only) - e.g. close/reopen, edit fields
router.patch('/:id', auth, requireRole('recruiter'), async (req, res) => {
  try {
    const drive = await Drive.findOne({ _id: req.params.id, recruiter: req.userId });
    if (!drive) return res.status(404).json({ message: 'Drive not found' });

    const allowed = ['companyName', 'driveTitle', 'jobDescription', 'requirements', 'stipend', 'type', 'status'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) drive[field] = req.body[field];
    });
    await drive.save();
    res.json(drive);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete a drive (owner recruiter only) - also deletes its applications
router.delete('/:id', auth, requireRole('recruiter'), async (req, res) => {
  try {
    const drive = await Drive.findOneAndDelete({ _id: req.params.id, recruiter: req.userId });
    if (!drive) return res.status(404).json({ message: 'Drive not found' });
    await Application.deleteMany({ drive: drive._id });
    res.json({ message: 'Drive deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Analyze all applications for a drive with AI, returns them sorted by score (desc)
router.post('/:id/analyze', auth, requireRole('recruiter'), async (req, res) => {
  try {
    const drive = await Drive.findOne({ _id: req.params.id, recruiter: req.userId });
    if (!drive) return res.status(404).json({ message: 'Drive not found' });

    const user = await User.findById(req.userId);
    if (!user.groqApiKey) {
      return res.status(400).json({ message: 'Please add your Groq API key in Settings before analyzing.' });
    }

    let apiKey;
    try {
      apiKey = decrypt(user.groqApiKey);
    } catch (decryptErr) {
      return res.status(400).json({
        message: 'Your saved Groq API key could not be read (the server ENCRYPTION_KEY may have changed). Please re-save your key in Settings.'
      });
    }

    const applications = await Application.find({ drive: drive._id });
    if (applications.length === 0) {
      return res.status(400).json({ message: 'No applications to analyze yet' });
    }

    let successCount = 0;
    const failures = []; // { name, reason }
    let fatalError = null; // e.g. invalid API key - stop immediately

    // Small worker pool (3 at a time) so many applicants don't make the request too slow
    const CONCURRENCY = 3;
    let index = 0;
    const worker = async () => {
      while (index < applications.length && !fatalError) {
        const application = applications[index++];
        try {
          const scored = await scoreApplicationForDrive(apiKey, application.extractedText, drive);
          application.atsScore = scored.atsScore;
          application.matchedSkills = scored.matchedSkills;
          application.missingSkills = scored.missingSkills;
          application.suggestions = scored.suggestions;
          application.analyzedAt = new Date();
          await application.save();
          successCount++;
        } catch (innerErr) {
          console.error(`Failed to analyze application ${application._id}:`, innerErr.message);
          if (innerErr.kind === 'auth') fatalError = innerErr;
          failures.push({ name: application.name, reason: innerErr.message });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, applications.length) }, worker));

    if (fatalError) {
      return res.status(400).json({ message: fatalError.message });
    }

    // Nothing worked: report the REAL reason instead of a fake "success" message
    if (successCount === 0) {
      const reasons = [...new Set(failures.map((f) => f.reason))].join(' | ');
      return res.status(502).json({ message: `Analysis failed for all ${applications.length} application(s). ${reasons}` });
    }

    const sorted = await Application.find({ drive: drive._id })
      .select('-resumeFileBase64 -extractedText')
      .sort({ atsScore: -1, createdAt: -1 });

    res.json({
      message: `Analyzed ${successCount} of ${applications.length} applications`,
      failures,
      applications: sorted
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Bulk shortlist/reject applications based on a score threshold chosen by the recruiter
router.post('/:id/shortlist', auth, requireRole('recruiter'), async (req, res) => {
  try {
    const { minScore } = req.body;
    if (minScore === undefined || minScore === null || minScore < 0 || minScore > 100) {
      return res.status(400).json({ message: 'minScore must be a number between 0 and 100' });
    }

    const drive = await Drive.findOne({ _id: req.params.id, recruiter: req.userId });
    if (!drive) return res.status(404).json({ message: 'Drive not found' });

    await Application.updateMany(
      { drive: drive._id, atsScore: { $gte: Number(minScore) } },
      { $set: { status: 'shortlisted' } }
    );
    await Application.updateMany(
      { drive: drive._id, atsScore: { $lt: Number(minScore), $ne: null } },
      { $set: { status: 'rejected' } }
    );

    const applications = await Application.find({ drive: drive._id })
      .select('-resumeFileBase64 -extractedText')
      .sort({ atsScore: -1, createdAt: -1 });

    res.json({ message: `Shortlisted candidates scoring ${minScore}% or above`, applications });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
