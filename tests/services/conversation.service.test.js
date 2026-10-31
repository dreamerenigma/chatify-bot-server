import 'dotenv/config';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../../src/config/firebase.js';
import {  getConversation, getOrCreateConversation } from '../../src/services/conversation.service.js';

const bots = db.collection('Bots');

const cleanupRefs = [];

let activeBotId;

before(async () => {
  const botRef = bots.doc(`test_${randomUUID()}`);

  cleanupRefs.push(botRef);

  await botRef.set({
    name: 'Conversation Service Test Bot',
    isActive: true,
    ownerType: 'test',
  });

  activeBotId = botRef.id;
});

after(async () => {
  for (const ref of [...cleanupRefs].reverse()) {
    await ref.delete();
  }
});

function createTestConversation() {
  const userId = `test_${randomUUID()}`;

  const conversationRef = bots.doc(activeBotId).collection('conversations').doc(userId);

  cleanupRefs.push(conversationRef);

  return {
    userId,
    conversationRef,
  };
}

test('getOrCreateConversation creates a new conversation', async () => {
  const { userId } = createTestConversation();

  const conversation = await getOrCreateConversation(activeBotId, userId);

  assert.ok(conversation);

  assert.equal(conversation.id, userId);
  assert.equal(conversation.botId, activeBotId);
  assert.equal(conversation.userId, userId);
  assert.equal(conversation.status, 'active');
  
  assert.equal(conversation.lastMessage, null);
  assert.equal(conversation.lastMessageAt, null);

  assert.ok(conversation.createdAt);
  assert.ok(conversation.updatedAt);
});

test('getConversation returns an existing conversation', async () => {
  const { userId } = createTestConversation();

  await getOrCreateConversation(activeBotId, userId);

  const conversation = await getConversation(activeBotId, userId);

  assert.ok(conversation);
  assert.equal(conversation.id, userId);
  assert.equal(conversation.botId, activeBotId);
  assert.equal(conversation.userId, userId);
});

test('getOrCreateConversation does not duplicate an existing conversation', async () => {
  const { userId } = createTestConversation();

  const firstConversation = await getOrCreateConversation(activeBotId, userId);

  const secondConversation = await getOrCreateConversation(activeBotId, userId);

  assert.equal(firstConversation.id, secondConversation.id);

  assert.ok(firstConversation.createdAt.isEqual(secondConversation.createdAt));

  const document = await bots.doc(activeBotId).collection('conversations').doc(userId).get();

  assert.equal(document.exists, true);
});

test('getOrCreateConversation throws BOT_NOT_FOUND for a missing bot', async () => {
  const missingBotId = `missing_${randomUUID()}`;
  const userId = `test_${randomUUID()}`;

  await assert.rejects(getOrCreateConversation(missingBotId, userId), (error) => error.code === 'BOT_NOT_FOUND');
});

test('getOrCreateConversation throws BOT_INACTIVE for an inactive bot', async () => {
  const inactiveBotRef = bots.doc(`test_${randomUUID()}`);

  cleanupRefs.push(inactiveBotRef);

  await inactiveBotRef.set({
    name: 'Inactive Test Bot',
    isActive: false,
    ownerType: 'test',
  });

  const userId = `test_${randomUUID()}`;

  await assert.rejects(getOrCreateConversation(inactiveBotRef.id, userId), (error) => error.code === 'BOT_INACTIVE');
});

test('getConversation returns null when conversation does not exist', async () => {
  const userId = `test_${randomUUID()}`;

  const conversation = await getConversation(activeBotId, userId);

  assert.equal(conversation, null);
});
