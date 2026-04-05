import fs from 'fs';

export function isDocker(): boolean {
  if (process.env.DOCKER_CONTAINER) return true;
  try {
    fs.accessSync('/.dockerenv');
    return true;
  } catch {
    return false;
  }
}

export function getDataDir(): string {
  return process.env.CTS_DATA_DIR ?? `${process.env.HOME ?? '/root'}/.claude-token-saver`;
}

export function warnIfDockerWithoutMount(): void {
  if (isDocker() && !process.env.CTS_DATA_DIR) {
    console.warn(
      '\x1b[33mWarning: Running in Docker without CTS_DATA_DIR set — tracking data will be lost when the container stops.\x1b[0m'
    );
    console.warn(
      '\x1b[33mSuggestion: docker run -v ~/.claude-token-saver:/root/.claude-token-saver ...\x1b[0m'
    );
  }
}
