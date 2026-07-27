const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
  drive: { type: mongoose.Schema.Types.ObjectId, ref: 'Drive', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Details filled in by the student on the application form
  name: { type: String, required: true },
  contact: { type: String, required: true },
  education: { type: String, required: true },
  appliedRole: { type: String, default: '' },

  // Resume storage - kept in Mongo as base64 so it survives on free-tier hosts with ephemeral disks
  resumeFileName: String,
  resumeMimeType: { type: String, default: 'application/pdf' },
  resumeFileBase64: String,
  extractedText: String,

  // AI scoring results (populated when the recruiter clicks "Analyze")
  atsScore: { type: Number, default: null },
  matchedSkills: [String],
  missingSkills: [String],
  suggestions: [String],
  analyzedAt: { type: Date, default: null },

  status: { type: String, enum: ['applied', 'shortlisted', 'rejected'], default: 'applied' },
  createdAt: { type: Date, default: Date.now }
});

// A student can only apply once per drive
ApplicationSchema.index({ drive: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('Application', ApplicationSchema);
