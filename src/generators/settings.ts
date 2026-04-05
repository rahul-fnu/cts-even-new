import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export type Preset = 'default' | 'balanced' | 'aggressive';

// Settings managed by this generator. Existing settings outside these keys are preserved.
const MANAGED_KEYS = [
  'autoCompactThreshold',
  'thinkingTokens',
  'subagentModel',
  'enableSubagentCalls',
] as const;

type ManagedKey = (typeof MANAGED_KEYS)[number];

interface PresetConfig extends Partial<Record<ManagedKey, unknown>> {
  // autocompact triggers a /compact when context reaches this fraction (0–1)
  autoCompactThreshold: number;
  // maximum tokens allocated to extended thinking; 'default' uses the model's default
  thinkingTokens: number | 'default';
  // model used for sub-agent / background tasks
  subagentModel: string;
  // whether to allow non-essential background agent calls (e.g. auto-summarisation)
  enableSubagentCalls: boolean;
}

function presetConfig(preset: Preset | string): PresetConfig {
  switch (preset) {
    case 'aggressive':
      return {
        // Compact early at 40% to keep context lean
        autoCompactThreshold: 0.4,
        // Limit thinking tokens to 5k to save on reasoning overhead
        thinkingTokens: 5000,
        // Cheaper model for sub-agent work
        subagentModel: 'claude-haiku-4-5-20251001',
        // Disable non-essential background calls
        enableSubagentCalls: false,
      };

    case 'balanced':
      return {
        // Compact at 50%
        autoCompactThreshold: 0.5,
        // Allow 10k thinking tokens
        thinkingTokens: 10000,
        // Use Sonnet for sub-agents
        subagentModel: 'claude-sonnet-4-6',
        // Enable sub-agent calls
        enableSubagentCalls: true,
      };

    default: // 'default'
      return {
        // Compact at 70% — close to the natural limit
        autoCompactThreshold: 0.7,
        // Let the model decide thinking token budget
        thinkingTokens: 'default',
        // Use Sonnet for sub-agents
        subagentModel: 'claude-sonnet-4-6',
        // Enable sub-agent calls
        enableSubagentCalls: true,
      };
  }
}

/**
 * Generate .claude/settings.json content for the given preset.
 *
 * Merges with any existing settings at <root>/.claude/settings.json so that
 * user-defined keys (permissions, custom tool configs, etc.) are preserved.
 * Only the keys managed by this generator are overwritten.
 */
export function generateSettings(root: string, preset: Preset | string): string {
  // Load existing settings if present
  const settingsPath = join(root, '.claude', 'settings.json');
  let existing: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try {
      const raw = readFileSync(settingsPath, 'utf-8');
      existing = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // Ignore malformed JSON — start fresh with defaults
    }
  }

  const managed = presetConfig(preset);

  // Merge: preserve all existing keys, overwrite only managed keys
  const merged: Record<string, unknown> = {
    ...existing,
    ...managed,
  };

  return JSON.stringify(merged, null, 2);
}
