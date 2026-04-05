import { Command } from 'commander';

export function auditCommand(): Command {
  return new Command('audit')
    .description('Audit token usage in the current project')
    .action(() => {
      console.log('Auditing token usage...');
    });
}
