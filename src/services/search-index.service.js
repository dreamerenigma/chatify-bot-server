import { db } from '../config/firebase.js';

const bots = db.collection('Bots');
const searchIndex = db.collection('global_search_index');

function toSearchIndexEntry(bot) {
  const name = typeof bot.name === 'string' ? bot.name.trim() : '';
  const username = typeof bot.username === 'string' ? bot.username.trim().toLowerCase() : '';
  const isSystemBot = bot.isSystem === true && bot.ownerId === 'system' && bot.role === 'orchestrator';

  return {
    targetId: bot.id,
    type: 'bot',
    name,
    nameLower: name.toLowerCase(),
    username,
    subtitle: isSystemBot ? 'Системный бот Chatify' : (bot.description ?? ''),
    avatarUrl: bot.avatar ?? null,
    isSearchable: name.length > 0 && bot.isActive !== false,
  };
}

/// -- Создаёт или обновляет запись в глобальном поисковом индексе.
export async function syncBotSearchIndex(bot) {
  if (!bot || typeof bot.id !== 'string' || !bot.id) {
    throw new Error('Для индексации необходим корректный bot.id.');
  }

  const entry = toSearchIndexEntry(bot);

  await searchIndex.doc(bot.id).set(entry, { merge: true });

  return entry;
}

/// -- Удаляет бота из глобального поискового индекса.
export async function deleteBotSearchIndex(botId) {
  if (typeof botId !== 'string' || !botId) {
    throw new Error('Необходимо указать botId.');
  }

  await searchIndex.doc(botId).delete();
}

/// -- Перестраивает индекс для всех существующих ботов.
export async function rebuildBotSearchIndex() {
  const snapshot = await bots.get();
  const existingBotIds = new Set(snapshot.docs.map((doc) => doc.id));

  let indexed = 0;
  let deleted = 0;

  for (let start = 0; start < snapshot.docs.length; start += 400) {
    const batch = db.batch();
    const chunk = snapshot.docs.slice(start, start + 400);

    for (const document of chunk) {
      const bot = {
        ...document.data(),
        id: document.id,
      };

      batch.set(searchIndex.doc(document.id),  toSearchIndexEntry(bot), { merge: true });

      indexed++;
    }

    await batch.commit();
  }

  const indexSnapshot = await searchIndex.get();

  for (let start = 0; start < indexSnapshot.docs.length; start += 400) {
    const chunk = indexSnapshot.docs.slice(start, start + 400);
    const batch = db.batch();
    let hasChanges = false;

    for (const document of chunk) {
      if (!existingBotIds.has(document.id)) {
        batch.delete(document.ref);
        deleted++;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await batch.commit();
    }
  }

  return { indexed, deleted };
}
