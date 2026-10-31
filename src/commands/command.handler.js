import { getCommand } from './command.registry.js';
import { getCurrentSession } from '../services/session.service.js';

const COMMAND_PREFIX = '/';

function parseCommand(text) {
  if (typeof text !== 'string') {
    return null;
  }

  const trimmedText = text.trim();

  if (!trimmedText.startsWith(COMMAND_PREFIX)) {
    return null;
  }

  const [rawCommand] = trimmedText.split(/\s+/);

  const commandName = rawCommand.slice(COMMAND_PREFIX.length).split('@')[0].toLowerCase();

  if (!/^[a-z0-9_]+$/.test(commandName)) {
    return null;
  }

  return commandName;
}

export async function handleCommand({botId, conversationId, userId, text}) {
  if (!botId || !conversationId || !userId) {
    throw new Error('Не переданы обязательные параметры обработки команды.');
  }

  if (typeof text !== 'string' || !text.trim()) {
    return {
      handled: false,
    };
  }

  const session = await getCurrentSession(botId, conversationId);

  if (session) {
    const command = getCommand(session.command);

    if (!command) {
      return {
        handled: true,
        response: {
          text:
            'Активный сценарий больше не поддерживается. ' +
            'Используйте /cancel, чтобы завершить его.',
        },
      };
    }

    return {
      handled: true,
      response: await command.handler({
        botId,
        conversationId,
        userId,
        text: text.trim(),
        session,
      }),
    };
  }

  const commandName = parseCommand(text);

  if (!commandName) {
    return {
      handled: false,
    };
  }

  const command = getCommand(commandName);

  if (!command) {
    return {
      handled: true,
      response: {
        text:
          `Команда /${commandName} не найдена.\n\n` +
          'Используйте /newbot, чтобы создать нового бота.',
      },
    };
  }

  const response = await command.handler({
    botId,
    conversationId,
    userId,
    text: text.trim(),
    session: null,
  });

  return {
    handled: true,
    response,
  };
}
