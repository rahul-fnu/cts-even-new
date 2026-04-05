import { Command } from 'commander';
import { warnIfDockerWithoutMount } from '../utils/docker.js';
import { getTrackingFilePath, mergeTrackingFiles } from '../utils/tracker.js';

export function trackCommand(): Command {
  const track = new Command('track')
    .description('Track token usage over time')
    .action(() => {
      warnIfDockerWithoutMount();
      console.log('Tracking token usage...');
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
