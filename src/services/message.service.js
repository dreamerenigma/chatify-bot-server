import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/firebase.js';

const bots = db.collection('Bots');

function getConversationRef(botId, conversationId) {
  if (typeof botId !== 'string' || !botId.trim()) {
    throw new Error('Не указан идентификатор бота.');
  }

  if (typeof conversationId !== 'string' || !conversationId.trim()) {
    throw new Error('Не указан идентификатор диалога.');
  }

  return bots
    .doc(botId)
    .collection('conversations')
    .doc(conversationId);
}

function toMessage(document) {
  if (!document.exists) {
    return null;
  }

  return {
    ...document.data(),
    id: document.id,
  };
}

export async function createMessage({botId, conversationId, senderId, senderType, text, type = 'text', metadata}) {
  if (typeof senderId !== 'string' || !senderId.trim()) {
    throw new Error('Не указан отправитель сообщения.');
  }

  if (!['user', 'bot'].includes(senderType)) {
    throw new Error('Некорректный тип отправителя.');
  }

  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Текст сообщения не может быть пустым.');
  }

  if (typeof type !== 'string' || !type.trim()) {
    throw new Error('Не указан тип сообщения.');
  }

  const conversationRef = getConversationRef(botId, conversationId);
  const messageRef = conversationRef.collection('messages').doc();

  const messageData = {
    conversationId,
    senderId,
    senderType,
    text: text.trim(),
    type,
    status: 'sent',
    createdAt: FieldValue.serverTimestamp(),
  };

  if (metadata != null) {
    messageData.metadata = metadata;
  }

  await db.runTransaction(async (transaction) => {
    const conversationDocument = await transaction.get(conversationRef);

    if (!conversationDocument.exists) {
      const error = new Error('Диалог не найден.');
      error.code = 'CONVERSATION_NOT_FOUND';
      throw error;
    }

    transaction.create(messageRef, messageData);

    transaction.update(conversationRef, {
      lastMessage: text.trim(),
      lastMessageAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  const document = await messageRef.get();

  return toMessage(document);
}

export async function getMessages(botId, conversationId, limit = 50) {
  const conversationRef = getConversationRef(botId, conversationId);

  const conversationDocument = await conversationRef.get();

  if (!conversationDocument.exists) {
    const error = new Error('Диалог не найден.');
    error.code = 'CONVERSATION_NOT_FOUND';
    throw error;
  }

  const snapshot = await conversationRef.collection('messages').orderBy('createdAt', 'asc').limit(limit).get();

  return snapshot.docs.map(toMessage);
}

export async function updateMessageStatus({ botId, conversationId, messageId, status}) {
  const allowedStatuses = [
    'sending',
    'sent',
    'delivered',
    'read',
    'failed',
  ];

  if (!allowedStatuses.includes(status)) {
    throw new Error('Некорректный статус сообщения.');
  }

  const conversationRef = getConversationRef(botId, conversationId);
  const messageRef = conversationRef.collection('messages').doc(messageId);

  const updateData = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (status === 'delivered') {
    updateData.deliveredAt = FieldValue.serverTimestamp();
  }

  if (status === 'read') {
    updateData.readAt = FieldValue.serverTimestamp();
  }

  await db.runTransaction(async (transaction) => {
    const document = await transaction.get(messageRef);

    if (!document.exists) {
      const error = new Error('Сообщение не найдено.');
      error.code = 'MESSAGE_NOT_FOUND';
      throw error;
    }

    transaction.update(messageRef, updateData);
  });

  return {
    id: messageId,
    status,
  };
}
