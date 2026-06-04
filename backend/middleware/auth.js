const jwt = require('jsonwebtoken');

const JWT_SECRET = 'gayaji_traders_jwt_secret_2026';

function auth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token missing' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

function deliveryOnly(req, res, next) {
  if (!req.user || req.user.role !== 'delivery') {
    return res.status(403).json({ message: 'Delivery staff access required' });
  }
  next();
}

module.exports = {
  auth,
  adminOnly,
  deliveryOnly,
  JWT_SECRET
};
