import { Router } from 'express';
import { db } from '../config/firebase.js';
import { requireAuth } from '../config/middleware/auth.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'chatify-bot-server',
  });
});

router.get('/firebase', async (_req, res) => {
  try {
    await db.collection('Bots').limit(1).get();

    return res.json({
      status: 'ok',
      firebase: 'connected',
    });
  } catch (error) {
    console.error('Firebase health check failed:', error.message);

    return res.status(503).json({
      status: 'error',
      firebase: 'unavailable',
    });
  }
});

router.get('/auth', requireAuth, (req, res) => {
  res.json({
    status: 'ok',
    authenticated: true,
    uid: req.user.uid,
  });
});

export default router;
