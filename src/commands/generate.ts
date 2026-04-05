import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { scanProject } from '../utils/scanner.js';
import { generateClaudeignore, Preset } from '../generators/claudeignore.js';
import { generateClaudemd } from '../generators/claudemd.js';
import { generateSettings } from '../generators/settings.js';
import { generateHooks } from '../generators/hooks.js';

const VALID_TARGETS = ['claudeignore', 'claudemd', 'settings', 'hooks'] as const;
type Target = typeof VALID_TARGETS[number];

const PRESET_DESCRIPTIONS: Record<Preset, string> = {
  minimal: 'Minimal — only the essentials, low overhead',
  balanced: 'Balanced — sensible defaults for most projects (recommended)',
  aggressive: 'Aggressive — strict controls, maximum token savings',
};

function writeIfSafe(filePath: string, content: string, force: boolean): boolean {
  if (fs.existsSync(filePath) && !force) {
    console.warn(`  [skip] ${filePath} already exists (use --force to overwrite)`);
    return false;
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`  [write] ${filePath}`);
  return true;
}

export function generateCommand(): Command {
  return new Command('generate')
    .description('Generate a Claude configuration file')
    .argument('<target>', `File to generate: ${VALID_TARGETS.join(' | ')}`)
    .option('--force', 'overwrite existing files', false)
    .option('--preset <preset>', 'preset: minimal | balanced | aggressive', 'balanced')
    .action((target: string, options: { force: boolean; preset: string }) => {
      if (!VALID_TARGETS.includes(target as Target)) {
        console.error(
          `Error: invalid target "${target}". Must be one of: ${VALID_TARGETS.join(', ')}`
        );
        process.exit(1);
      }

      const preset = options.preset as Preset;
      if (!['minimal', 'balanced', 'aggressive'].includes(preset)) {
        console.error(
          `Error: invalid preset "${preset}". Must be one of: minimal, balanced, aggressive`
        );
        process.exit(1);
      }

      const project = scanProject();
      console.log(`Detected project: ${project.name} (${project.type})`);
      console.log(`Preset: ${PRESET_DESCRIPTIONS[preset]}`);
      console.log('');

      const cwd = process.cwd();

      switch (target as Target) {
        case 'claudeignore': {
          const content = generateClaudeignore(preset, project);
          writeIfSafe(path.join(cwd, '.claudeignore'), content, options.force);
          break;
        }

        case 'claudemd': {
          const content = generateClaudemd(preset, project);
          writeIfSafe(path.join(cwd, 'CLAUDE.md'), content, options.force);
          break;
        }

        case 'settings': {
          const settings = generateSettings(preset, project);
          const content = JSON.stringify(settings, null, 2) + '\n';
          writeIfSafe(path.join(cwd, '.claude', 'settings.json'), content, options.force);
          break;
        }

        case 'hooks': {
          const scripts = generateHooks(preset, project);
          const hooksDir = path.join(cwd, '.claude', 'hooks');
          let allOk = true;
          for (const [name, content] of Object.entries(scripts)) {
            const filePath = path.join(hooksDir, name);
            const written = writeIfSafe(filePath, content, options.force);
            if (written) {
              fs.chmodSync(filePath, 0o755);
            }
            allOk = allOk || written;
          }
          break;
        }
      }
    });
}
