import { Command } from 'commander';

export function initCommand(): Command {
  return new Command('init')
    .description('Initialize claude-token-saver in the current project')
    .action(() => {
      console.log('Initializing claude-token-saver...');
    });
}
