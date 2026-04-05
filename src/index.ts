#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { auditCommand } from './commands/audit.js';
import { generateCommand } from './commands/generate.js';
import { trackCommand } from './commands/track.js';

const program = new Command();

program
  .name('claude-token-saver')
  .description('CLI tool for managing Claude token usage')
  .version('1.0.0');

program.addCommand(initCommand());
program.addCommand(auditCommand());
program.addCommand(generateCommand());
program.addCommand(trackCommand());

program.parse();
