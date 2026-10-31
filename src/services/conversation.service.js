import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/firebase.js';

const bots = db.collection('Bots');

/**
 * Возвращает ссылку на диалог конкретного пользователя с ботом.
 *
 * Структура:
 * Bots/{botId}/conversations/{userId}
 *
 * @param {string} botId - ID бота.
 * @param {string} userId - ID пользователя Firebase Auth.
 * @returns {FirebaseFirestore.DocumentReference}
 */
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

/**
 * Преобразует документ Firestore в объект диалога.
 *
 * @param {FirebaseFirestore.DocumentSnapshot} document
 * @returns {object|null}
 */
function toConversation(document) {
  if (!document.exists) {
    return null;
  }

  return {
    ...document.data(),
    id: document.id,
  };
}

/**
 * Получает существующий диалог пользователя с ботом.
 *
 * Возвращает null, если диалог ещё не создан.
 *
 * @param {string} botId - ID бота.
 * @param {string} userId - ID пользователя.
 * @returns {Promise<object|null>}
 */
export async function getConversation(botId, userId) {
  const conversationRef = getConversationRef(botId, userId);

  const document = await conversationRef.get();

  return toConversation(document);
}

/**
 * Получает существующий диалог или создаёт новый.
 *
 * Создание выполняется в транзакции, чтобы избежать
 * появления дублирующих диалогов при одновременных запросах.
 *
 * @param {string} botId - ID бота.
 * @param {string} userId - ID пользователя.
 * @returns {Promise<object>}
 */
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
