const express = require('express');
const router = express.Router();
const localDb = require('../localDb');
const { auth } = require('../middleware/auth');

// Get notifications
router.get('/', auth, (req, res) => {
  let notifications = [];
  if (req.user.role === 'admin') {
    const adminNotifs = localDb.find('notifications', { userId: 'admin' });
    const userNotifs = localDb.find('notifications', { userId: req.user._id });
    notifications = [...adminNotifs, ...userNotifs];
  } else {
    notifications = localDb.find('notifications', { userId: req.user._id });
  }
  
  res.json(notifications.reverse());
});

// Mark notification as read
router.put('/:id/read', auth, (req, res) => {
  localDb.update('notifications', { _id: req.params.id }, { read: true });
  res.json({ message: 'Notification marked as read' });
});

// Mark all as read
router.put('/read-all', auth, (req, res) => {
  const targetId = req.user.role === 'admin' ? 'admin' : req.user._id;
  localDb.update('notifications', { userId: targetId }, { read: true });
  if (req.user.role === 'admin') {
    localDb.update('notifications', { userId: req.user._id }, { read: true });
  }
  res.json({ message: 'All notifications marked as read' });
});

module.exports = router;
