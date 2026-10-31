import { Router } from 'express';
import { db } from '../config/firebase.js';
import { requireAuth } from '../config/middleware/auth.js';
import { handleCommand } from '../commands/command.handler.js';
import { getMasterBot } from '../services/master-bot.service.js';
import { getOrCreateConversation } from '../services/conversation.service.js';
import { createMessage, getMessages, updateMessageStatus, updateMessageContent } from '../services/message.service.js';
import { handleMyBotsCommand, handleMyBotMenu } from '../commands/mybots.command.js';
import { getConversation } from '../services/conversation.service.js';

const router = Router();
const bots = db.collection('Bots');

router.use(requireAuth);

router.post('/mybots/callback', async (req, res) => {
  try {
    const uid = req.user.uid;

    const {
      botId,
      conversationId,
      messageId,
      callbackData,
    } = req.body ?? {};

    if (typeof botId !== 'string' || typeof conversationId !== 'string' || typeof messageId !== 'string' || typeof callbackData !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Некорректные параметры callback.',
      });
    }

    if (conversationId !== uid) {
      return res.status(403).json({
        status: 'error',
        message: 'Нет доступа к этому диалогу.',
      });
    }

    const bot = await checkBotAccess(uid, botId);

    if (bot.isSystem !== true || bot.role !== 'orchestrator') {
      return res.status(403).json({
        status: 'error',
        message: 'Эта операция недоступна.',
      });
    }

    const conversation = await getConversation(botId, uid);

    if (!conversation) {
      return res.status(404).json({
        status: 'error',
        message: 'Диалог не найден.',
      });
    }

    let result;

    if (callbackData === 'mybots') {
      result = await handleMyBotsCommand({
        userId: uid,
      });
    } else {
      const match = callbackData.match(/^mybot:([^:]+)$/);

      if (match) {
        result = await handleMyBotMenu({
          userId: uid,
          botId: match[1],
        });
      } else {
        return res.status(400).json({
          status: 'error',
          message: 'Неизвестное действие.',
        });
      }
    }

    const updatedMessage = await updateMessageContent({
      botId,
      conversationId,
      messageId,
      callbackData,
      text: result.text,
      metadata: result.metadata ?? {},
    });

    return res.json({
      status: 'ok',
      message: updatedMessage,
    });
  } catch (error) {
    return handleError(error, res);
  }
});

async function checkBotAccess(uid, botId) {
  const masterBot = await getMasterBot();

  if (botId === masterBot.id) {
    if (masterBot.isActive !== true) {
      const error = new Error('Бот неактивен.');
      error.code = 'BOT_INACTIVE';
      throw error;
    }

    return masterBot;
  }

  const botDocument = await bots.doc(botId).get();

  if (!botDocument.exists) {
    const error = new Error('Бот не найден.');
    error.code = 'BOT_NOT_FOUND';
    throw error;
  }

  const bot = {
    ...botDocument.data(),
    id: botDocument.id,
  };

  if (bot.isSystem === true || bot.ownerType === 'system') {
    const error = new Error('Доступ к системному боту запрещён.');
    error.code = 'BOT_ACCESS_DENIED';
    throw error;
  }

  if (bot.isActive !== true) {
    const error = new Error('Бот неактивен.');
    error.code = 'BOT_INACTIVE';
    throw error;
  }

  const isOwner = bot.ownerId === uid;

  if (isOwner) {
    return bot;
  }

  const botUserDocument = await db.collection('BotUsers').doc(`${botId}_${uid}`).get();

  if (!botUserDocument.exists) {
    const error = new Error('Нет доступа к этому боту.');
    error.code = 'BOT_ACCESS_DENIED';
    throw error;
  }

  return bot;
}

function handleError(error, res) {
  switch (error.code) {
    case 'BOT_NOT_FOUND':
      return res.status(404).json({
        error: 'bot_not_found',
        message: error.message,
      });
    case 'BOT_INACTIVE':
      return res.status(403).json({
        error: 'bot_inactive',
        message: error.message,
      });
    case 'BOT_ACCESS_DENIED':
      return res.status(403).json({
        error: 'bot_access_denied',
        message: error.message,
      });
    case 'CONVERSATION_NOT_FOUND':
      return res.status(404).json({
        error: 'conversation_not_found',
        message: error.message,
      });
    case 'VALIDATION_ERROR':
      return res.status(400).json({
        error: 'validation_error',
        message: error.message,
      });
    case 'MASTER_BOT_NOT_FOUND':
    case 'MASTER_BOT_DUPLICATE':
    case 'MASTER_BOT_INVALID':
      console.error('MasterBot configuration error:', error.message);

      return res.status(500).json({
        error: 'master_bot_configuration_error',
        message: 'Ошибка конфигурации системного бота.',
      });

    default:
      console.error('Conversations API error:', error);

      return res.status(500).json({
        error: 'internal_server_error',
        message: 'Не удалось выполнить операцию с сообщениями.',
      });
  }
}

router.post('/:botId/messages', async (req, res) => {
  try {
    const { botId } = req.params;
    const { uid } = req.user;
    const { text } = req.body ?? {};

    if (typeof text !== 'string' || !text.trim()) {
      const error = new Error('Текст сообщения не может быть пустым.');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const bot = await checkBotAccess(uid, botId);
    const conversation = await getOrCreateConversation(botId, uid);

    const message = await createMessage({
      botId,
      conversationId: conversation.id,
      senderId: uid,
      senderType: 'user',
      text,
      type: 'text',
    });

    let botMessage = null;

    if (bot.isSystem === true && bot.role === 'orchestrator') {
      await updateMessageStatus({
        botId,
        conversationId: conversation.id,
        messageId: message.id,
        status: 'delivered',
      });

      await updateMessageStatus({
        botId,
        conversationId: conversation.id,
        messageId: message.id,
        status: 'read',
      });

      const result = await handleCommand({
        botId,
        conversationId: conversation.id,
        userId: uid,
        text,
      });

      if (result.handled && result.response?.text) {
        botMessage = await createMessage({
          botId,
          conversationId: conversation.id,
          senderId: bot.id,
          senderType: 'bot',
          text: result.response.text,
          type: 'text',
          metadata: result.response.metadata,
        });
      }
    }

    return res.status(201).json({
      status: 'ok',
      message,
      botMessage,
    });
  } catch (error) {
    return handleError(error, res);
  }
});

router.get('/:botId/messages', async (req, res) => {
  try {
    const { botId } = req.params;
    const { uid } = req.user;

    await checkBotAccess(uid, botId);

    const conversation = await getOrCreateConversation(botId, uid);

    const requestedLimit = Number(req.query.limit ?? 50);

    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
      const error = new Error('Лимит должен быть от 1 до 100.');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const messages = await getMessages(botId, conversation.id, requestedLimit);

    return res.json({
      status: 'ok',
      conversation,
      messages,
    });
  } catch (error) {
    return handleError(error, res);
  }
});

router.post('/mybots/callback', async (req, res) => {
  try {
    const { uid } = req.user;
    const { callbackData, botId, conversationId, messageId } = req.body ?? {};

    if (!callbackData || !conversationId || !messageId) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Не переданы обязательные параметры.',
      });
    }

    let result;

    if (callbackData === 'mybots') {
      result = await handleMyBotsCommand({
        userId: uid,
      });
    } else {
      const parts = callbackData.split(':');

      if (parts[0] === 'mybot' && parts.length === 2) {
        result = await handleMyBotMenu({
          userId: uid,
          botId: parts[1],
        });
      } else {
        return res.status(400).json({
          error: 'unknown_callback',
          message: 'Неизвестное действие.',
        });
      }
    }

    const updatedMessage = await updateMessage({
      botId,
      conversationId,
      messageId,
      text: result.text,
      metadata: result.metadata ?? null,
    });

    return res.json({
      status: 'ok',
      message: updatedMessage,
    });
  } catch (error) {
    return handleError(error, res);
  }
});

export default router;
