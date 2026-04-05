import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { warnIfDockerWithoutMount } from '../utils/docker.js';
import {
  getTrackingFilePath,
  mergeTrackingFiles,
  logSession,
  clearData,
  exportCsv,
  getStats,
  printStats,
} from '../utils/tracker.js';

const BANNER = `
  ╔══════════════════════════════════════╗
  ║   CTS Token Usage Tracker            ║
  ╚══════════════════════════════════════╝`;

export function trackCommand(): Command {
  const track = new Command('track')
    .description('Track token usage over time')
    .option('--log <tokens>', 'log a session with the given token count')
    .option('--note <note>', 'attach a note to the logged session (use with --log)')
    .option('--days <days>', 'show stats for last N days', '7')
    .option('--reset', 'clear all tracking data')
    .option('--export', 'export tracking data as CSV')
    .action((opts: { log?: string; note?: string; days: string; reset?: boolean; export?: boolean }) => {
      warnIfDockerWithoutMount();

      // Reset mode
      if (opts.reset) {
        clearData();
        console.log('Tracking data cleared.');
        return;
      }

      // Export mode
      if (opts.export) {
        const csv = exportCsv();
        const today = new Date().toISOString().slice(0, 10);
        const filename = `claude-token-usage-${today}.csv`;
        const outPath = path.join(process.cwd(), filename);
        fs.writeFileSync(outPath, csv, 'utf-8');
        console.log(`Exported to ${outPath}`);
        return;
      }

      // Log mode
      if (opts.log !== undefined) {
        const tokens = parseInt(opts.log, 10);
        if (isNaN(tokens) || tokens <= 0) {
          console.error('Error: --log requires a positive integer token count.');
          process.exit(1);
        }
        logSession(tokens, opts.note);
        const days = parseInt(opts.days, 10) || 7;
        const stats = getStats(days);
        const today = stats.days[stats.days.length - 1];
        console.log(`Logged ${formatNumber(tokens)} tokens.`);
        if (today) {
          console.log(`Today so far: ${formatNumber(today.tokens)} tokens across ${today.sessions} session(s).`);
        }
        return;
      }

      // Dashboard mode
      const days = parseInt(opts.days, 10) || 7;
      console.log(BANNER);
      console.log(`\n  Last ${days} days\n`);
      const stats = getStats(days);
      printStats(stats);
      console.log();

      // Contextual tips
      const tips: string[] = [];
      if (stats.avgTokens > 50_000) {
        tips.push('High average token usage — consider running /compact to reduce context size.');
      }
      if (stats.trend === 'up') {
        tips.push('Usage is trending up — try the "aggressive" preset: cts init --preset aggressive');
      } else if (stats.trend === 'down') {
        tips.push('Usage is trending down — great work keeping token costs low!');
      }
      if (stats.projects.length > 3) {
        tips.push('You\'re working across many projects — use /clear between projects to reset context.');
      }

      if (tips.length > 0) {
        console.log('  Tips:');
        for (const tip of tips) {
          console.log(`  • ${tip}`);
        }
        console.log();
      }

      // Data file path and export hint
      const dataPath = getTrackingFilePath();
      console.log(`  Data file : ${dataPath}`);
      console.log('  Export    : cts track --export');
    });

  track
    .command('merge <file>')
    .description('Merge sessions from another tracking.json file')
    .action((file: string) => {
      warnIfDockerWithoutMount();
      const primaryPath = getTrackingFilePath();
      const { merged, duplicates } = mergeTrackingFiles(primaryPath, file);
      const total = merged + duplicates;
      console.log(
        `Merged ${total} sessions from ${file} (${merged} new, ${duplicates} duplicates)`
      );
    });

  return track;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
