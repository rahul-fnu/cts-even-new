import type { Preset } from './claudeignore.js';

export function generateSettings(preset: Preset = 'balanced'): Record<string, unknown> {
  const hooksConfig = {
    hooks: {
      UserPromptSubmit: [
        {
          matcher: '',
          hooks: [{ type: 'command', command: '.claude/hooks/session-start.sh' }],
        },
      ],
      PostToolUse: [
        {
          matcher: '',
          hooks: [{ type: 'command', command: '.claude/hooks/post-tool.sh' }],
        },
      ],
      PreCompact: [
        {
          matcher: '',
          hooks: [{ type: 'command', command: '.claude/hooks/pre-compact.sh' }],
        },
      ],
    },
  };

  if (preset === 'minimal') {
    return hooksConfig;
  }

  const balanced: Record<string, unknown> = {
    ...hooksConfig,
    env: {
      CTS_PRESET: preset,
    },
  };

  if (preset === 'aggressive') {
    (balanced['env'] as Record<string, string>)['CTS_AGGRESSIVE'] = '1';
  }

  return balanced;
}

export function mergeSettings(
  existing: Record<string, unknown>,
  additions: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...existing };

  for (const [key, value] of Object.entries(additions)) {
    if (
      key === 'hooks' &&
      typeof existing['hooks'] === 'object' &&
      existing['hooks'] !== null &&
      typeof value === 'object' &&
      value !== null
    ) {
      result['hooks'] = mergeHooks(
        existing['hooks'] as Record<string, unknown[]>,
        value as Record<string, unknown[]>
      );
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      typeof existing[key] === 'object' &&
      existing[key] !== null &&
      !Array.isArray(existing[key])
    ) {
      result[key] = { ...(existing[key] as Record<string, unknown>), ...(value as Record<string, unknown>) };
    } else if (existing[key] === undefined) {
      result[key] = value;
    }
  }

  return result;
}

function mergeHooks(
  existing: Record<string, unknown[]>,
  additions: Record<string, unknown[]>
): Record<string, unknown[]> {
  const result: Record<string, unknown[]> = { ...existing };

  for (const [event, newEntries] of Object.entries(additions)) {
    if (!result[event]) {
      result[event] = newEntries;
    } else {
      // Append entries whose command isn't already present
      const existingCommands = new Set(
        result[event].flatMap((entry) => {
          const e = entry as { hooks?: Array<{ command?: string }> };
          return (e.hooks ?? []).map((h) => h.command);
        })
      );
      for (const entry of newEntries) {
        const e = entry as { hooks?: Array<{ command?: string }> };
        const commands = (e.hooks ?? []).map((h) => h.command);
        if (!commands.some((c) => existingCommands.has(c))) {
          result[event] = [...result[event], entry];
        }
      }
    }
  }

  return result;
}
