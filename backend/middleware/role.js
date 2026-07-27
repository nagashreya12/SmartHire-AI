// Usage: router.post('/', auth, requireRole('recruiter'), handler)
module.exports = function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ message: `Access denied. This action requires role: ${roles.join(' or ')}.` });
    }
    next();
  };
};
