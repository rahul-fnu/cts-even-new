import { Command } from 'commander';

export function generateCommand(): Command {
  return new Command('generate')
    .description('Generate Claude configuration files')
    .action(() => {
      console.log('Generating configuration files...');
    });
}
