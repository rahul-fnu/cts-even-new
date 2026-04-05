import { Command } from 'commander';
import { scanProject } from '../utils/scanner.js';
import {
  printBanner,
  printProjectSummary,
  printLargeFiles,
  printIssues,
  printScore,
} from '../utils/display.js';

export function auditCommand(): Command {
  return new Command('audit')
    .description('Audit token usage in the current project')
    .option('--json', 'Output raw JSON instead of formatted terminal output')
    .action((options: { json?: boolean }) => {
      const info = scanProject(process.cwd());

      if (options.json) {
        console.log(JSON.stringify(info, null, 2));
        return;
      }

      printBanner();
      printProjectSummary(info);
      printLargeFiles(info.largeFiles);
      printIssues(info.issues);
      printScore(info.score, info.issues);

      if (info.issues.length > 0) {
        console.log();
        console.log('  Run `cts init` to automatically fix all issues.');
      }

      console.log();
    });
}
