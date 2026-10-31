import { handleNewBotCommand } from './newbot.command.js';
import { handleCancelCommand } from './cancel.command.js';
import { handleMyBotsCommand } from './mybots.command.js';

const commands = new Map([
  [
    'newbot',
    { name: 'newbot', description: 'Создать нового бота', handler: handleNewBotCommand },
  ],
  [
    'cancel',
    { name: 'cancel', description: 'Отменить текущее действие', handler: handleCancelCommand },
  ],
  [
    'mybots',
    { name: 'mybots', description: 'Мои боты', handler: handleMyBotsCommand },
  ],
]);

export function getCommand(commandName) {
  if (typeof commandName !== 'string') {
    return null;
  }

  return commands.get(commandName.toLowerCase()) ?? null;
}

export function getCommands() {
  return Array.from(commands.values()).map(({ name, description }) => ({
    name,
    description,
  }));
}

export function hasCommand(commandName) {
  return getCommand(commandName) !== null;
}
