import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../../src/config/firebase.js';
import { createSession, getCurrentSession } from '../../src/services/session.service.js';
import { handleCommand } from '../../src/commands/command.handler.js';

const fixtures = [];

async function createFixture() {
  const botId = `test-${randomUUID()}`;
  const conversationId = `conversation-${randomUUID()}`;
  const userId = `user-${randomUUID()}`;

  const botRef = db.collection('Bots').doc(botId);
  await botRef.set({ id: botId, name: 'Test Bot' });

  fixtures.push({ botRef, conversationId });

  return { botId, conversationId, userId };
}

afterEach(async () => {
  for (const { botRef, conversationId } of fixtures.splice(0)) {
    await botRef.collection('conversations').doc(conversationId).collection('sessions').doc('current').delete();

    await botRef.delete();
  }
});

test('handleCommand cancels an active session when /cancel is received', async () => {
  const { botId, conversationId, userId } = await createFixture();

  await createSession({
    botId,
    conversationId,
    command: 'newbot',
    step: 'waiting_for_name',
    data: {},
  });

  const result = await handleCommand({
    botId,
    conversationId,
    userId,
    text: '/cancel',
  });

  assert.equal(result.handled, true);
  assert.match(result.response.text, /Действие отменено/);

  const session = await getCurrentSession(botId, conversationId);
  assert.equal(session, null);
});

test('handleCommand responds when /cancel is received without an active session', async () => {
  const { botId, conversationId, userId } = await createFixture();

  const result = await handleCommand({
    botId,
    conversationId,
    userId,
    text: '/cancel',
  });

  assert.equal(result.handled, true);
  assert.match(result.response.text, /нет активного действия/i);

  const session = await getCurrentSession(botId, conversationId);
  assert.equal(session, null);
});
