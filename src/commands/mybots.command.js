import { getUserBots } from '../services/bot.service.js';

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