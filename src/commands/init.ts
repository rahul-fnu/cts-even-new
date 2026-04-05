import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { generateClaudeignore, type Preset } from '../generators/claudeignore.js';
import { generateClaudemd } from '../generators/claudemd.js';
import { generateHooks } from '../generators/hooks.js';
import { generateSettings, mergeSettings } from '../generators/settings.js';

const PRESET_DESCRIPTIONS: Record<Preset, string> = {
  minimal: 'Basic .claudeignore and CLAUDE.md only',
  balanced: 'Recommended settings with hooks and optimizations',
  aggressive: 'Maximum token reduction with strict ignore rules',
};

const VALID_PRESETS: Preset[] = ['minimal', 'balanced', 'aggressive'];

interface ScanResult {
  score: number;
  details: Record<string, boolean>;
}

function scanProject(cwd: string): ScanResult {
  const checks = {
    '.claudeignore': fs.existsSync(path.join(cwd, '.claudeignore')),
    'CLAUDE.md': fs.existsSync(path.join(cwd, 'CLAUDE.md')),
    '.claude/settings.json': fs.existsSync(path.join(cwd, '.claude', 'settings.json')),
    '.claude/hooks/session-start.sh': fs.existsSync(path.join(cwd, '.claude', 'hooks', 'session-start.sh')),
    '.claude/hooks/post-tool.sh': fs.existsSync(path.join(cwd, '.claude', 'hooks', 'post-tool.sh')),
    '.claude/hooks/pre-compact.sh': fs.existsSync(path.join(cwd, '.claude', 'hooks', 'pre-compact.sh')),
  };

  const weights: Record<string, number> = {
    '.claudeignore': 25,
    'CLAUDE.md': 20,
    '.claude/settings.json': 20,
    '.claude/hooks/session-start.sh': 12,
    '.claude/hooks/post-tool.sh': 12,
    '.claude/hooks/pre-compact.sh': 11,
  };

  const score = Object.entries(checks).reduce((sum, [key, exists]) => {
    return sum + (exists ? (weights[key] ?? 0) : 0);
  }, 0);

  return { score, details: checks };
}

function scoreColor(score: number): string {
  if (score >= 80) return chalk.green.bold(`${score}%`);
  if (score >= 50) return chalk.yellow.bold(`${score}%`);
  return chalk.red.bold(`${score}%`);
}

export function initCommand(): Command {
  return new Command('init')
    .description('Initialize claude-token-saver in the current project')
    .option('-y, --yes', 'skip prompts, overwrite existing files')
    .option('--preset <preset>', 'minimal | balanced | aggressive (default: balanced)', 'balanced')
    .action(async (options: { yes?: boolean; preset: string }) => {
      const yes = options.yes ?? false;
      const presetRaw = options.preset;
      const preset: Preset = VALID_PRESETS.includes(presetRaw as Preset)
        ? (presetRaw as Preset)
        : 'balanced';

      if (!VALID_PRESETS.includes(presetRaw as Preset)) {
        console.warn(chalk.yellow(`  Unknown preset "${presetRaw}", defaulting to "balanced"`));
      }

      const cwd = process.cwd();

      // Banner
      console.log();
      console.log(chalk.bold.blue('  ┌─────────────────────────────────────┐'));
      console.log(chalk.bold.blue('  │      Claude Token Saver — Init      │'));
      console.log(chalk.bold.blue('  └─────────────────────────────────────┘'));
      console.log();
      console.log(`  Project: ${chalk.cyan(cwd)}`);
      console.log(`  Preset:  ${chalk.cyan(preset)} — ${PRESET_DESCRIPTIONS[preset]}`);
      if (yes) console.log(`  Mode:    ${chalk.yellow('--yes (overwrite existing files)')}`);
      console.log();

      // Pre-scan
      const preSpinner = ora('Scanning project...').start();
      await tick();
      const before = scanProject(cwd);
      preSpinner.succeed(`Project scanned — efficiency score: ${scoreColor(before.score)}`);
      console.log();

      const created: string[] = [];
      const skipped: string[] = [];

      // .claudeignore
      const claudeignorePath = path.join(cwd, '.claudeignore');
      if (!fs.existsSync(claudeignorePath) || yes) {
        fs.writeFileSync(claudeignorePath, generateClaudeignore(preset));
        created.push('.claudeignore');
      } else {
        skipped.push('.claudeignore');
      }

      // CLAUDE.md
      const claudemdPath = path.join(cwd, 'CLAUDE.md');
      if (!fs.existsSync(claudemdPath) || yes) {
        const content = generateClaudemd();
        fs.writeFileSync(claudemdPath, content);
        const lineCount = content.split('\n').length;
        if (lineCount > 200) {
          console.warn(chalk.yellow(`  Warning: CLAUDE.md has ${lineCount} lines (> 200 recommended)`));
        }
        created.push('CLAUDE.md');
      } else {
        const existing = fs.readFileSync(claudemdPath, 'utf-8');
        const lineCount = existing.split('\n').length;
        if (lineCount > 200) {
          console.warn(chalk.yellow(`  Warning: existing CLAUDE.md has ${lineCount} lines (> 200 recommended)`));
        }
        skipped.push('CLAUDE.md');
      }

      // .claude/settings.json — always merge
      const claudeDir = path.join(cwd, '.claude');
      const settingsPath = path.join(claudeDir, 'settings.json');
      fs.mkdirSync(claudeDir, { recursive: true });

      let existingSettings: Record<string, unknown> = {};
      if (fs.existsSync(settingsPath)) {
        try {
          existingSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
        } catch {
          // ignore parse errors, start fresh
        }
      }

      const merged = mergeSettings(existingSettings, generateSettings(preset));
      fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n');
      created.push('.claude/settings.json');

      // Hook scripts
      const hooksDir = path.join(claudeDir, 'hooks');
      fs.mkdirSync(hooksDir, { recursive: true });

      const hooks = generateHooks();
      const hookEntries: Array<{ name: keyof typeof hooks; label: string }> = [
        { name: 'session-start.sh', label: '.claude/hooks/session-start.sh' },
        { name: 'post-tool.sh', label: '.claude/hooks/post-tool.sh' },
        { name: 'pre-compact.sh', label: '.claude/hooks/pre-compact.sh' },
      ];

      for (const { name, label } of hookEntries) {
        const hookPath = path.join(hooksDir, name);
        if (!fs.existsSync(hookPath) || yes) {
          fs.writeFileSync(hookPath, hooks[name]);
          created.push(label);
        } else {
          skipped.push(label);
        }
        // Always ensure hook is executable
        fs.chmodSync(hookPath, 0o755);
      }

      // Summary
      console.log(chalk.bold('  Files created:'));
      if (created.length === 0) {
        console.log(`    ${chalk.gray('(none)')}`);
      } else {
        for (const f of created) {
          console.log(`    ${chalk.green('+')} ${f}`);
        }
      }

      if (skipped.length > 0) {
        console.log();
        console.log(chalk.bold('  Files skipped (already exist):'));
        for (const f of skipped) {
          console.log(`    ${chalk.gray('-')} ${f}  ${chalk.gray('(use -y to overwrite)')}`);
        }
      }
      console.log();

      // Post-scan
      const postSpinner = ora('Re-scanning project...').start();
      await tick();
      const after = scanProject(cwd);
      postSpinner.succeed(`Updated efficiency score: ${scoreColor(after.score)}`);

      if (after.score > before.score) {
        console.log(
          `  ${chalk.green('↑')} Score improved by ${chalk.green.bold(`+${after.score - before.score}`)} points`
        );
      }
      console.log();

      // Next steps
      console.log(chalk.bold('  Next steps:'));
      console.log(`    1. Review the generated files`);
      console.log(`    2. Customize ${chalk.cyan('CLAUDE.md')} for your project`);
      console.log(`    3. Start a Claude session to begin logging usage`);
      console.log(`    4. Run ${chalk.cyan('cts audit')} to view the dashboard`);
      console.log(`    5. Run ${chalk.cyan('cts audit')} periodically to re-audit token usage`);
      console.log();
    });
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 300));
}
