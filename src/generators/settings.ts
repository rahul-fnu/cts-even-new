import { ProjectInfo } from '../utils/scanner.js';
import { Preset } from './claudeignore.js';

export function generateSettings(preset: Preset, project: ProjectInfo): Record<string, unknown> {
  const base: Record<string, unknown> = {
    env: {
      CTS_DATA_DIR: '~/.claude-token-saver',
    },
  };

  if (preset === 'minimal') {
    return base;
  }

  const balanced: Record<string, unknown> = {
    ...base,
    permissions: {
      allow: [
        'Bash(git:*)',
        'Read',
        'Edit',
        'Write',
        'Glob',
        'Grep',
      ],
      deny: [],
    },
    hooks: {
      PreToolUse: [],
      PostToolUse: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: '.claude/hooks/post-tool.sh',
            },
          ],
        },
      ],
      Stop: [],
      Notification: [],
    },
  };

  if (preset === 'balanced') {
    return balanced;
  }

  // aggressive
  const aggressive: Record<string, unknown> = {
    ...balanced,
    permissions: {
      allow: [
        'Bash(git:*)',
        ...(project.type === 'node' ? ['Bash(npm:*)', 'Bash(npx:*)'] : []),
        ...(project.type === 'python' ? ['Bash(python:*)', 'Bash(pip:*)', 'Bash(pytest:*)'] : []),
        ...(project.type === 'go' ? ['Bash(go:*)'] : []),
        ...(project.type === 'rust' ? ['Bash(cargo:*)'] : []),
        'Read',
        'Edit',
        'Write',
        'Glob',
        'Grep',
      ],
      deny: [
        'Bash(curl:*)',
        'Bash(wget:*)',
        'Bash(rm -rf:*)',
      ],
    },
    autoUpdaterStatus: 'disabled',
  };

  return aggressive;
}
