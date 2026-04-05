import fs from 'fs';
import path from 'path';

export type ProjectType = 'node' | 'python' | 'go' | 'rust' | 'unknown';

export interface ProjectInfo {
  type: ProjectType;
  hasGit: boolean;
  name: string;
}

export function scanProject(cwd: string = process.cwd()): ProjectInfo {
  const hasGit = fs.existsSync(path.join(cwd, '.git'));

  let name = path.basename(cwd);
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
    if (pkg.name) name = pkg.name;
  } catch {
    // ignore
  }

  let type: ProjectType = 'unknown';
  if (fs.existsSync(path.join(cwd, 'package.json'))) {
    type = 'node';
  } else if (
    fs.existsSync(path.join(cwd, 'requirements.txt')) ||
    fs.existsSync(path.join(cwd, 'pyproject.toml')) ||
    fs.existsSync(path.join(cwd, 'setup.py'))
  ) {
    type = 'python';
  } else if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    type = 'go';
  } else if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
    type = 'rust';
  }

  return { type, hasGit, name };
}
