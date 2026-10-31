import { getUserBots, getBotById } from '../services/bot.service.js';

function toCamelCase(username) {
  return username
    .split(/[_\-\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

export async function handleMyBotsCommand(context) {
  const { userId } = context;

  const bots = await getUserBots(userId);

  const regularBots = bots.filter(
    (bot) => bot.isSystem !== true && bot.ownerType !== 'system'
  );

  if (regularBots.length === 0) {
    return {
      text:
        'У вас пока нет созданных ботов.\n\n' +
        'Используйте /newbot, чтобы создать своего первого бота.',
    };
  }

  const buttons = regularBots.map((bot, index) => ({
    text: `@${bot.username}`,
    callbackData: `mybot:${bot.id}`,
    colSpan: regularBots.length % 2 !== 0 && index === regularBots.length - 1 ? 2 : 1,
  }));

  return {
    text: 'Выберите бота из списка ниже:',
    metadata: {
      keyboard: {
        type: 'inline',
        columns: 2,
        buttons,
      },
    },
  };
}

export async function handleMyBotMenu(context) {
  const { userId, botId } = context;
  const bot = await getBotById(userId, botId);
  const username = toCamelCase(bot.username);

  return {
    text: `${bot.name}\n@${username}`,
    metadata: {
      keyboard: {
        type: 'inline',
        columns: 2,
        buttons: [
          {
            text: 'API Token',
            callbackData: `mybot:token:${bot.id}`,
          },
          {
            text: 'Edit Bot',
            callbackData: `mybot:edit:${bot.id}`,
          },
          {
            text: 'Bot Settings',
            callbackData: `mybot:settings:${bot.id}`,
          },
          {
            text: 'Payments',
            callbackData: `mybot:payments:${bot.id}`,
          },
          {
            text: 'Transfer Ownership',
            callbackData: `mybot:transfer:${bot.id}`,
          },
          {
            text: 'Delete Bot',
            callbackData: `mybot:delete:${bot.id}`,
          },
          {
            text: '⬅ Back to Bot List',
            callbackData: 'mybots',
            colSpan: 2,
          },
        ],
      },
    },
  };
}
