import { handleNewBotCommand } from './newbot.command.js';

const commands = new Map([
  [
    'newbot',
    {
      name: 'newbot',
      description: 'Создать нового бота',
      handler: handleNewBotCommand,
    },
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
