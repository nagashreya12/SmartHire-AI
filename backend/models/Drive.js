const mongoose = require('mongoose');

const DriveSchema = new mongoose.Schema({
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyName: { type: String, required: true, trim: true },
  driveTitle: { type: String, required: true, trim: true }, // e.g. "Drive 1 - SDE Internship"
  jobDescription: { type: String, default: '' },
  requirements: { type: String, default: '' }, // free text: required skills / qualifications
  stipend: { type: String, default: '' }, // e.g. "₹25,000/month" or "₹8 LPA"
  type: { type: String, enum: ['internship', 'fulltime'], required: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Drive', DriveSchema);
