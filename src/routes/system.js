import { Router } from 'express';
import { requireAuth } from '../config/middleware/auth.js';
import { getMasterBot } from '../services/master-bot.service.js';

const router = Router();

router.get('/master-bot', requireAuth, async (_req, res) => {
  try {
    const masterBot = await getMasterBot();

    return res.json({
      status: 'ok',
      bot: masterBot,
    });
  } catch (error) {
    if (error.code === 'MASTER_BOT_NOT_FOUND') {
      return res.status(404).json({
        error: 'master_bot_not_found',
        message: 'Системный бот не найден.',
      });
    }

    if (error.code === 'MASTER_BOT_DUPLICATE' || error.code === 'MASTER_BOT_INVALID') {
      console.error('MasterBot configuration error:', error.message);

      return res.status(500).json({
        error: 'master_bot_configuration_error',
        message: 'Ошибка конфигурации системного бота.',
      });
    }

    console.error('Failed to get MasterBot:', error.message);

    return res.status(500).json({
      error: 'internal_server_error',
      message: 'Не удалось получить системного бота.',
    });
  }
});

export default router;
