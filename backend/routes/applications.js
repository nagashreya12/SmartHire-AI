const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const Application = require('../models/Application');
const Drive = require('../models/Drive');

// Use memory storage (not disk) since resumes are stored as base64 in MongoDB -
// this also works cleanly on hosts with ephemeral/free-tier disks like Render.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  }
});

// Student applies to a drive
router.post('/', auth, requireRole('student'), upload.single('resume'), async (req, res) => {
  try {
    const { driveId, name, contact, education, appliedRole } = req.body;
    if (!driveId || !name || !contact || !education) {
      return res.status(400).json({ message: 'driveId, name, contact and education are required' });
    }
    if (!req.file) return res.status(400).json({ message: 'Resume PDF is required' });

    const drive = await Drive.findById(driveId);
    if (!drive) return res.status(404).json({ message: 'Drive not found' });
    if (drive.status !== 'open') return res.status(400).json({ message: 'This drive is closed for applications' });

    const existing = await Application.findOne({ drive: driveId, student: req.userId });
    if (existing) return res.status(400).json({ message: 'You have already applied to this drive' });

    const parsed = await pdfParse(req.file.buffer);
    if (!parsed.text || parsed.text.trim().length < 20) {
      return res.status(400).json({ message: 'Could not extract readable text from this PDF. Try another file.' });
    }

    const application = await Application.create({
      drive: driveId,
      student: req.userId,
      name,
      contact,
      education,
      appliedRole: appliedRole || drive.driveTitle,
      resumeFileName: req.file.originalname,
      resumeMimeType: req.file.mimetype,
      resumeFileBase64: req.file.buffer.toString('base64'),
      extractedText: parsed.text
    });

    res.status(201).json({ message: 'Application submitted successfully', applicationId: application._id });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'You have already applied to this drive' });
    }
    res.status(500).json({ message: err.message });
  }
});

// Student: view their own applications and statuses
router.get('/my', auth, requireRole('student'), async (req, res) => {
  try {
    const applications = await Application.find({ student: req.userId })
      .select('-resumeFileBase64 -extractedText')
      .populate('drive', 'companyName driveTitle type stipend status')
      .sort({ createdAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Recruiter: view all applications for one of their own drives, sorted by AI score
router.get('/drive/:driveId', auth, requireRole('recruiter'), async (req, res) => {
  try {
    const drive = await Drive.findOne({ _id: req.params.driveId, recruiter: req.userId });
    if (!drive) return res.status(404).json({ message: 'Drive not found' });

    const applications = await Application.find({ drive: req.params.driveId })
      .select('-resumeFileBase64 -extractedText')
      .sort({ atsScore: -1, createdAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// View/download a candidate's original resume PDF
// Allowed for: the recruiter who owns the drive, or the student who submitted it
router.get('/:id/resume', auth, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id).populate('drive');
    if (!application) return res.status(404).json({ message: 'Application not found' });

    const isOwnerRecruiter = application.drive.recruiter.toString() === req.userId;
    const isOwnerStudent = application.student.toString() === req.userId;
    if (!isOwnerRecruiter && !isOwnerStudent) {
      return res.status(403).json({ message: 'Not authorized to view this resume' });
    }

    const buffer = Buffer.from(application.resumeFileBase64, 'base64');
    res.setHeader('Content-Type', application.resumeMimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${application.resumeFileName}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Recruiter: manually change one candidate's status (in addition to the bulk shortlist filter)
router.patch('/:id/status', auth, requireRole('recruiter'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['applied', 'shortlisted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const application = await Application.findById(req.params.id).populate('drive');
    if (!application || application.drive.recruiter.toString() !== req.userId) {
      return res.status(404).json({ message: 'Application not found' });
    }
    application.status = status;
    await application.save();
    res.json(application);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
