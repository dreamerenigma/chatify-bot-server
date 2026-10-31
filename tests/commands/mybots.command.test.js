import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../../src/config/firebase.js';
import { handleMyBotsCommand } from '../../src/commands/mybots.command.js';

const fixtures = [];

async function createBotFixture({name, username, ownerId, ownerType = 'user', isSystem = false}) {
  const botId = `test-${randomUUID()}`;
  const botRef = db.collection('Bots').doc(botId);

  await botRef.set({
    id: botId,
    name,
    username,
    ownerId,
    ownerType,
    isSystem,
  });

  fixtures.push(botRef);

  return botId;
}

afterEach(async () => {
  for (const botRef of fixtures.splice(0)) {
    await botRef.delete();
  }
});

test('handleMyBotsCommand returns an empty-state message when user has no bots', async () => {
  const result = await handleMyBotsCommand({
    userId: `user-${randomUUID()}`,
  });

  assert.match(result.text, /пока нет созданных ботов/i);
  assert.match(result.text, /\/newbot/);
});

test('handleMyBotsCommand returns only regular bots belonging to the user', async () => {
  const userId = `user-${randomUUID()}`;
  const anotherUserId = `user-${randomUUID()}`;

  await createBotFixture({
    name: 'Weather Bot',
    username: 'weather_bot',
    ownerId: userId,
  });

  await createBotFixture({
    name: 'News Bot',
    username: 'news_bot',
    ownerId: userId,
  });

  await createBotFixture({
    name: 'Another User Bot',
    username: 'another_user_bot',
    ownerId: anotherUserId,
  });

  await createBotFixture({
    name: 'MasterBot',
    username: 'masterbot',
    ownerId: 'system',
    ownerType: 'system',
    isSystem: true,
  });

  const result = await handleMyBotsCommand({ userId });

  assert.match(result.text, /Ваши боты \(2\)/);
  assert.match(result.text, /Weather Bot/);
  assert.match(result.text, /@weather_bot/);
  assert.match(result.text, /News Bot/);
  assert.match(result.text, /@news_bot/);

  assert.doesNotMatch(result.text, /Another User Bot/);
  assert.doesNotMatch(result.text, /MasterBot/);
});
