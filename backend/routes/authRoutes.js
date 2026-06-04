const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const localDb = require('../localDb');
const { auth, adminOnly, JWT_SECRET } = require('../middleware/auth');

// Register customer
router.post('/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const existingUser = localDb.findOne('users', { email: email.toLowerCase() });
  if (existingUser) {
    return res.status(400).json({ message: 'User already exists with this email' });
  }

  // Set default role mapping for testing ease
  let role = 'customer';
  const emailLower = email.toLowerCase();
  const adminExists = localDb.findOne('users', { role: 'admin' });
  if (emailLower === 'admin@gayaji.com' && !adminExists) {
    role = 'admin';
  } else if (emailLower === 'delivery@gayaji.com') {
    role = 'delivery';
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const newUser = localDb.insert('users', {
    name,
    email: email.toLowerCase(),
    phone,
    passwordHash,
    role,
    addresses: []
  });

  const token = jwt.sign(
    { _id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role, phone: newUser.phone },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    token,
    user: {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      phone: newUser.phone,
      addresses: newUser.addresses
    }
  });
});

// Login user
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = localDb.findOne('users', { email: email.toLowerCase() });
  if (!user) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  const isMatch = bcrypt.compareSync(password, user.passwordHash);
  if (!isMatch) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { _id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      addresses: user.addresses || []
    }
  });
});

// Get user profile
router.get('/me', auth, (req, res) => {
  const user = localDb.findOne('users', { _id: req.user._id });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    addresses: user.addresses || []
  });
});

// Save or Update Addresses
router.put('/address', auth, (req, res) => {
  const { addresses } = req.body;
  if (!Array.isArray(addresses)) {
    return res.status(400).json({ message: 'Addresses must be an array' });
  }

  localDb.update('users', { _id: req.user._id }, { addresses });
  res.json({ message: 'Addresses updated successfully', addresses });
});

// Admin Transfer
router.post('/admin-transfer', auth, adminOnly, (req, res) => {
  const { targetUserId } = req.body;
  if (!targetUserId) {
    return res.status(400).json({ message: 'Target user ID is required' });
  }

  const targetUser = localDb.findOne('users', { _id: targetUserId });
  if (!targetUser) {
    return res.status(404).json({ message: 'Target user not found' });
  }

  if (targetUser.role === 'admin') {
    return res.status(400).json({ message: 'Target user is already an admin' });
  }

  if (targetUser.role !== 'customer' && targetUser.role !== 'delivery') {
    return res.status(400).json({ message: 'Target user must be a Customer or Delivery staff' });
  }

  const phonePattern = /^[6-9]\d{9}$/;
  if (!targetUser.email || !targetUser.phone || !phonePattern.test(targetUser.phone)) {
    return res.status(400).json({ message: 'Target user profile has invalid email or mobile contact format' });
  }

  // 1. Promote target user to admin
  localDb.update('users', { _id: targetUserId }, { role: 'admin' });

  // 2. Demote current user to customer
  localDb.update('users', { _id: req.user._id }, { role: 'customer' });

  res.json({
    message: 'Admin rights successfully transferred.',
    demotedUser: req.user._id,
    promotedUser: targetUserId
  });
});

// Get list of all users (authenticated only)
router.get('/users', auth, (req, res) => {
  const users = localDb.find('users');
  const safeUsers = users.map(u => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone
  }));
  res.json(safeUsers);
});

// Get system settings
router.get('/settings', (req, res) => {
  let settings = localDb.findOne('settings', { type: 'global' });
  if (!settings) {
    settings = localDb.insert('settings', {
      type: 'global',
      accountNumber: '987654321098',
      phone: '6207342872',
      qrCodeUrl: ''
    });
  }
  res.json(settings);
});

// Update system settings (Admin only)
router.put('/settings', auth, adminOnly, (req, res) => {
  const { accountNumber, phone, qrCodeUrl } = req.body;
  const updates = {};
  if (accountNumber !== undefined) updates.accountNumber = accountNumber;
  if (phone !== undefined) updates.phone = phone;
  if (qrCodeUrl !== undefined) updates.qrCodeUrl = qrCodeUrl;

  let settings = localDb.findOne('settings', { type: 'global' });
  if (!settings) {
    localDb.insert('settings', {
      type: 'global',
      accountNumber: accountNumber || '987654321098',
      phone: phone || '6207342872',
      qrCodeUrl: qrCodeUrl || ''
    });
  } else {
    localDb.update('settings', { type: 'global' }, updates);
  }

  const updatedSettings = localDb.findOne('settings', { type: 'global' });
  res.json(updatedSettings);
});

// Update user email and/or password (authenticated users)
router.put('/update-credentials', auth, (req, res) => {
  const { email, password } = req.body;
  const updates = {};

  if (email) {
    const emailLower = email.toLowerCase();
    // Verify email is not already taken by another user
    const existingUser = localDb.findOne('users', { email: emailLower });
    if (existingUser && existingUser._id !== req.user._id) {
      return res.status(400).json({ message: 'Email is already in use by another account' });
    }
    updates.email = emailLower;
  }

  if (password) {
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }
    const salt = bcrypt.genSaltSync(10);
    updates.passwordHash = bcrypt.hashSync(password, salt);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'No updates provided' });
  }

  localDb.update('users', { _id: req.user._id }, updates);
  
  // Fetch updated user to return
  const updatedUser = localDb.findOne('users', { _id: req.user._id });
  
  res.json({
    message: 'Credentials updated successfully',
    user: {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      phone: updatedUser.phone,
      addresses: updatedUser.addresses || []
    }
  });
});

module.exports = router;
