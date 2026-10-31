import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/firebase.js';

const bots = db.collection('Bots');

function getConversationRef(botId, userId) {
  if (typeof botId !== 'string' || !botId.trim()) {
    throw new Error('Не указан идентификатор бота.');
  }

  if (typeof userId !== 'string' || !userId.trim()) {
    throw new Error('Не указан идентификатор пользователя.');
  }

  return bots
    .doc(botId)
    .collection('conversations')
    .doc(userId);
}

function toConversation(document) {
  if (!document.exists) {
    return null;
  }

  return {
    ...document.data(),
    id: document.id,
  };
}

export async function getConversation(botId, userId) {
  const conversationRef = getConversationRef(botId, userId);

  const document = await conversationRef.get();

  return toConversation(document);
}

export async function getOrCreateConversation(botId, userId) {
  const botRef = bots.doc(botId);
  const conversationRef = getConversationRef(botId, userId);

  await db.runTransaction(async (transaction) => {
    const botDocument = await transaction.get(botRef);

    if (!botDocument.exists) {
      const error = new Error('Бот не найден.');
      error.code = 'BOT_NOT_FOUND';
      throw error;
    }

    const botData = botDocument.data();

    if (botData.isActive !== true) {
      const error = new Error('Бот неактивен.');
      error.code = 'BOT_INACTIVE';
      throw error;
    }

    const conversationDocument = await transaction.get(conversationRef);

    if (conversationDocument.exists) {
      return;
    }

    transaction.create(conversationRef, {
      botId,
      userId,
      status: 'active',
      lastMessage: null,
      lastMessageAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  const document = await conversationRef.get();

  return toConversation(document);
}
