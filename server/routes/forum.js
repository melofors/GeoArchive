const express = require('express');
const router = express.Router();
const db = require('../models/db');
const requireAuth = require('../middleware/requireAuth');

// GET /api/forum/threads — list all threads
router.get('/threads', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, title, body, author_username, created_at, reply_count
      FROM threads
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching threads:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/forum/threads/:id — get single thread + replies
router.get('/threads/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

  try {
    const threadResult = await db.query(
      'SELECT id, title, body, author_username, created_at, reply_count FROM threads WHERE id = $1',
      [id]
    );
    if (threadResult.rows.length === 0) return res.status(404).json({ error: 'Thread not found' });

    const postsResult = await db.query(
      'SELECT id, body, author_username, created_at FROM posts WHERE thread_id = $1 ORDER BY created_at ASC',
      [id]
    );

    res.json({ thread: threadResult.rows[0], posts: postsResult.rows });
  } catch (err) {
    console.error('Error fetching thread:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/forum/threads — create thread
router.post('/threads', requireAuth, async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'Title and body are required' });
  if (title.length > 200) return res.status(400).json({ error: 'Title too long' });
  if (body.length > 10000) return res.status(400).json({ error: 'Body too long' });

  try {
    const result = await db.query(
      'INSERT INTO threads (title, body, author_username) VALUES ($1, $2, $3) RETURNING id',
      [title.trim(), body.trim(), req.user.username]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Error creating thread:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/forum/threads/:id/reply — post reply
router.post('/threads/:id/reply', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'Body is required' });
  if (body.length > 10000) return res.status(400).json({ error: 'Reply too long' });

  try {
    const threadCheck = await db.query('SELECT id FROM threads WHERE id = $1', [id]);
    if (threadCheck.rows.length === 0) return res.status(404).json({ error: 'Thread not found' });

    await db.query(
      'INSERT INTO posts (thread_id, body, author_username) VALUES ($1, $2, $3)',
      [id, body.trim(), req.user.username]
    );
    await db.query('UPDATE threads SET reply_count = reply_count + 1 WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Error posting reply:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;