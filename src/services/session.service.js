import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/firebase.js';

const bots = db.collection('Bots');

function getSessionRef(botId, conversationId) {
  if (typeof botId !== 'string' || !botId.trim()) {
    throw new Error('Не указан идентификатор бота.');
  }

  if (typeof conversationId !== 'string' || !conversationId.trim()) {
    throw new Error('Не указан идентификатор диалога.');
  }

  return bots.doc(botId).collection('conversations').doc(conversationId).collection('sessions').doc('current');
}

function toSession(document) {
  if (!document.exists) {
    return null;
  }

  return {
    ...document.data(),
    id: document.id,
  };
}

export async function getCurrentSession(botId, conversationId) {
  const sessionRef = getSessionRef(botId, conversationId);
  const document = await sessionRef.get();

  return toSession(document);
}

export async function createSession({botId,conversationId,command, step, data = {}}) {
  if (typeof command !== 'string' || !command.trim()) {
    throw new Error('Не указана команда сессии.');
  }

  if (typeof step !== 'string' || !step.trim()) {
    throw new Error('Не указан шаг сессии.');
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Некорректные данные сессии.');
  }

  const sessionRef = getSessionRef(botId, conversationId);

  await db.runTransaction(async (transaction) => {
    const existingSession = await transaction.get(sessionRef);

    if (existingSession.exists) {
      const error = new Error('У пользователя уже есть активная сессия.');
      error.code = 'SESSION_ALREADY_ACTIVE';
      throw error;
    }

    transaction.create(sessionRef, {
      command: command.trim(),
      step: step.trim(),
      data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return getCurrentSession(botId, conversationId);
}

export async function updateSession({botId,conversationId,step, data}) {
  const sessionRef = getSessionRef(botId, conversationId);

  await db.runTransaction(async (transaction) => {
    const document = await transaction.get(sessionRef);

    if (!document.exists) {
      const error = new Error('Активная сессия не найдена.');
      error.code = 'SESSION_NOT_FOUND';
      throw error;
    }

    const currentData = document.data();

    const updates = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (step !== undefined) {
      if (typeof step !== 'string' || !step.trim()) {
        throw new Error('Некорректный шаг сессии.');
      }

      updates.step = step.trim();
    }

    if (data !== undefined) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Некорректные данные сессии.');
      }

      updates.data = {
        ...(currentData.data ?? {}),
        ...data,
      };
    }

    transaction.update(sessionRef, updates);
  });

  return getCurrentSession(botId, conversationId);
}

export async function deleteSession(botId, conversationId) {
  const sessionRef = getSessionRef(botId, conversationId);

  await sessionRef.delete();
}
