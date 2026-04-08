const express = require('express');
const router = express.Router();
const admin = require('../firebaseAdmin');
const requireAuth = require('../middleware/requireAuth');

function isValidUsername(username) {
  return typeof username === 'string' && /^[a-zA-Z0-9_]{3,30}$/.test(username);
}

// GET /api/user/me — get own username (requires auth)
// MUST be before /:username to avoid being matched as a username
router.get('/me', requireAuth, async (req, res) => {
  return res.json({ username: req.user.username });
});

// POST /api/user/bio — update own bio (requires auth)
router.post('/bio', requireAuth, async (req, res) => {
  try {
    const db = admin.firestore();
    const bio = req.body.bio ?? '';

    if (typeof bio !== 'string' || bio.length > 300) {
      return res.status(400).json({ error: 'Bio must be a string under 300 characters' });
    }

    const usersRef = db.collection('users');
    const querySnapshot = await usersRef.where('username', '==', req.user.username).limit(1).get();

    if (querySnapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    await querySnapshot.docs[0].ref.update({ bio: bio.trim() });

    return res.json({ success: true });
  } catch (err) {
    console.error('Error updating bio:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/user/:username — fetch user profile
// MUST be last since /:username matches anything
router.get('/:username', async (req, res) => {
  const db = admin.firestore();
  const pgDB = require('../models/db');
  const usernameRaw = req.params.username;

  if (!isValidUsername(usernameRaw)) {
    return res.status(400).json({ error: 'Invalid username' });
  }

  const username = usernameRaw;

  try {
    const usersRef = db.collection('users');
    const querySnapshot = await usersRef.where('username', '==', username).limit(1).get();

    if (querySnapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() || {};

    let submissionCount = 0;
    try {
      const result = await pgDB.query(
        `SELECT COUNT(*)
         FROM submissions
         WHERE user_id = $1
           AND status = 'approved'
           AND deleted = FALSE`,
        [userData.username || username]
      );
      submissionCount = Number(result.rows?.[0]?.count ?? 0);
    } catch (pgErr) {
      console.error('Error fetching submission count:', pgErr);
    }

    return res.json({
      username: userData.username || username,
      bio: userData.bio || '',
      created_at: userData.created_at ? userData.created_at.toDate().toISOString() : null,
      submissionCount
    });

  } catch (err) {
    console.error('Error in /api/user/:username route:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;