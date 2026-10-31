import { getUserBots } from '../services/bot.service.js';

const PUBLIC_BOT_URL = 'https://chatify.ru';

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

  const botList = regularBots.map((bot, index) => {
    return (
      `${index + 1}. ${bot.name}\n` +
      `   @${bot.username}\n` +
      `   ${PUBLIC_BOT_URL}/${bot.username}`
    );
  });

  return {
    text:
      `Ваши боты (${regularBots.length}):\n\n` +
      botList.join('\n\n'),
  };
}
