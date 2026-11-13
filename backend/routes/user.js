const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const { encrypt } = require('../utils/crypto');
const { testGroqKey } = require('../utils/groqClient');

// Check whether the logged-in user has a Groq key saved (never returns the key itself)
router.get('/api-key/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json({ hasKey: !!user.groqApiKey });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Save / update the Groq API key (encrypted at rest)
router.put('/api-key', auth, async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ message: 'API key is required' });
    }

    const encrypted = encrypt(apiKey.trim());
    await User.findByIdAndUpdate(req.userId, { groqApiKey: encrypted });
    res.json({ message: 'Groq API key saved successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Test a key against Groq before saving. Makes a tiny real request, so it also confirms
// that at least one currently-available model works with this key.
router.post('/api-key/test', auth, async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || !apiKey.trim()) return res.status(400).json({ message: 'API key is required' });

    const model = await testGroqKey(apiKey.trim());
    res.json({ valid: true, message: `Key is valid (model: ${model})` });
  } catch (err) {
    res.status(400).json({ valid: false, message: `Key test failed: ${err.message}` });
  }
});

// Remove the stored key
router.delete('/api-key', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, { groqApiKey: null });
    res.json({ message: 'API key removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
