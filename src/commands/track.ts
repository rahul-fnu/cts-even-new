import { Command } from 'commander';

export function trackCommand(): Command {
  return new Command('track')
    .description('Track token usage over time')
    .action(() => {
      console.log('Tracking token usage...');
    });
}
