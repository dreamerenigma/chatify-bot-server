import { Router } from 'express';
import { requireAuth } from '../config/middleware/auth.js';
import {getUserBots, getBotById, createBot, updateBot, deleteBot, addBotUser} from '../services/bot.service.js';

const router = Router();

router.use(requireAuth);

function handleError(error, res) {
  if (error.code === 'BOT_NOT_FOUND') {
    return res.status(404).json({
      error: 'bot_not_found',
      message: 'Бот не найден.',
    });
  }

  if (error.code === 'VALIDATION_ERROR' || error.code === 'SYSTEM_BOT_FORBIDDEN'
  ) {
    return res.status(400).json({
      error: error.code.toLowerCase(),
      message: error.message,
    });
  }

  console.error('Bots API error:', error.message);

  return res.status(500).json({
    error: 'internal_server_error',
    message: 'Не удалось выполнить операцию с ботом.',
  });
}

// -- Get the current user's bots.
router.get('/', async (req, res) => {
  try {
    const bots = await getUserBots(req.user.uid);
    return res.json({ status: 'ok', bots });
  } catch (error) {
    return handleError(error, res);
  }
});

/// -- Get a specific bot.
router.get('/:botId', async (req, res) => {
  try {
    const bot = await getBotById(req.user.uid, req.params.botId);
    return res.json({ status: 'ok', bot });
  } catch (error) {
    return handleError(error, res);
  }
});

/// -- Create bot.
router.post('/', async (req, res) => {
  try {
    const bot = await createBot(req.user.uid, req.body ?? {});
    return res.status(201).json({ status: 'ok', bot });
  } catch (error) {
    return handleError(error, res);
  }
});

/// -- Update bot.
router.patch('/:botId', async (req, res) => {
  try {
    const bot = await updateBot(req.user.uid, req.params.botId, req.body ?? {});

    return res.json({ status: 'ok', bot });
  } catch (error) {
    return handleError(error, res);
  }
});

/// -- Delete bot.
router.delete('/:botId', async (req, res) => {
  try {
    await deleteBot(req.user.uid, req.params.botId);
    return res.status(204).end();
  } catch (error) {
    return handleError(error, res);
  }
});

/// -- Add user bot.
router.post('/:botId/add-user', async (req, res) => {
  try {
    const bot = await addBotUser(req.user.uid, req.params.botId);

    return res.json({
      status: 'ok',
      bot,
    });
  } catch (error) {
    return handleError(error, res);
  }
});

export default router;
