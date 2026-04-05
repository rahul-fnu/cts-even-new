import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

export type Preset = 'default' | 'balanced' | 'aggressive';

interface PackageJson {
  name?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

// Detect frameworks from package.json dependencies (Node/JS ecosystem)
function detectNodeFrameworks(deps: Record<string, string>): string[] {
  const detected: string[] = [];

  const checks: Array<[string, string]> = [
    ['react', 'React'],
    ['next', 'Next.js'],
    ['vue', 'Vue'],
    ['nuxt', 'Nuxt'],
    ['@angular/core', 'Angular'],
    ['svelte', 'Svelte'],
    ['@sveltejs/kit', 'SvelteKit'],
    ['express', 'Express'],
    ['fastify', 'Fastify'],
    ['@nestjs/core', 'NestJS'],
    ['@remix-run/react', 'Remix'],
    ['@remix-run/node', 'Remix'],
    ['gatsby', 'Gatsby'],
    ['vite', 'Vite'],
    ['astro', 'Astro'],
    ['hono', 'Hono'],
    ['@hapi/hapi', 'Hapi'],
    ['koa', 'Koa'],
    ['trpc', 'tRPC'],
    ['@trpc/server', 'tRPC'],
    ['drizzle-orm', 'Drizzle ORM'],
    ['prisma', 'Prisma'],
    ['@prisma/client', 'Prisma'],
    ['typeorm', 'TypeORM'],
    ['sequelize', 'Sequelize'],
    ['mongoose', 'Mongoose'],
    ['socket.io', 'Socket.IO'],
    ['graphql', 'GraphQL'],
  ];

  const seen = new Set<string>();
  for (const [pkg, name] of checks) {
    if ((deps[pkg] !== undefined) && !seen.has(name)) {
      detected.push(name);
      seen.add(name);
    }
  }

  return detected;
}

// Detect Python frameworks from requirements.txt or pyproject.toml
function detectPythonFrameworks(root: string): string[] {
  const detected: string[] = [];

  const checks: Array<[RegExp, string]> = [
    [/\bdjango\b/i, 'Django'],
    [/\bflask\b/i, 'Flask'],
    [/\bfastapi\b/i, 'FastAPI'],
    [/\bsqlalchemy\b/i, 'SQLAlchemy'],
    [/\bcelery\b/i, 'Celery'],
    [/\bpydantic\b/i, 'Pydantic'],
    [/\btornado\b/i, 'Tornado'],
    [/\baiohttp\b/i, 'aiohttp'],
    [/\bstarlette\b/i, 'Starlette'],
    [/\balembic\b/i, 'Alembic'],
  ];

  const candidates = ['requirements.txt', 'requirements-dev.txt', 'pyproject.toml'];
  let content = '';
  for (const f of candidates) {
    const p = join(root, f);
    if (existsSync(p)) {
      content += readFileSync(p, 'utf-8') + '\n';
    }
  }

  const seen = new Set<string>();
  for (const [re, name] of checks) {
    if (re.test(content) && !seen.has(name)) {
      detected.push(name);
      seen.add(name);
    }
  }

  return detected;
}

// Detect Rust frameworks from Cargo.toml
function detectRustFrameworks(root: string): string[] {
  const cargoPath = join(root, 'Cargo.toml');
  if (!existsSync(cargoPath)) return [];

  const content = readFileSync(cargoPath, 'utf-8');
  const detected: string[] = [];

  const checks: Array<[RegExp, string]> = [
    [/\bactix[-_]web\b/i, 'Actix-web'],
    [/\baxum\b/i, 'Axum'],
    [/\brocket\b/i, 'Rocket'],
    [/\btokio\b/i, 'Tokio'],
    [/\bwarp\b/i, 'Warp'],
    [/\btide\b/i, 'Tide'],
    [/\bdiesel\b/i, 'Diesel'],
    [/\bsea[-_]orm\b/i, 'SeaORM'],
  ];

  for (const [re, name] of checks) {
    if (re.test(content)) detected.push(name);
  }

  return detected;
}

// Detect Go frameworks from go.mod
function detectGoFrameworks(root: string): string[] {
  const goModPath = join(root, 'go.mod');
  if (!existsSync(goModPath)) return [];

  const content = readFileSync(goModPath, 'utf-8');
  const detected: string[] = [];

  const checks: Array<[RegExp, string]> = [
    [/gin-gonic\/gin/i, 'Gin'],
    [/labstack\/echo/i, 'Echo'],
    [/gofiber\/fiber/i, 'Fiber'],
    [/gorilla\/mux/i, 'Gorilla Mux'],
    [/go-chi\/chi/i, 'Chi'],
    [/beego/i, 'Beego'],
    [/gorm\.io\/gorm/i, 'GORM'],
    [/ent\/ent/i, 'Ent'],
  ];

  for (const [re, name] of checks) {
    if (re.test(content)) detected.push(name);
  }

  return detected;
}

// Extract common scripts from package.json
function extractScripts(scripts: Record<string, string>): Array<[string, string]> {
  const relevant = ['build', 'test', 'dev', 'start', 'lint', 'format', 'typecheck', 'check'];
  return relevant
    .filter((k) => scripts[k] !== undefined)
    .map((k) => [k, scripts[k]] as [string, string]);
}

// Detect project type
function detectProjectType(root: string): string {
  if (existsSync(join(root, 'Cargo.toml'))) return 'rust';
  if (existsSync(join(root, 'go.mod'))) return 'go';
  if (
    existsSync(join(root, 'requirements.txt')) ||
    existsSync(join(root, 'pyproject.toml')) ||
    existsSync(join(root, 'setup.py'))
  )
    return 'python';
  if (existsSync(join(root, 'pom.xml')) || existsSync(join(root, 'build.gradle'))) return 'java';
  if (existsSync(join(root, 'Gemfile'))) return 'ruby';
  if (existsSync(join(root, 'package.json'))) return 'node';
  return 'unknown';
}

export function generateClaudeMd(
  root: string,
  projectType: string,
  preset: Preset | string,
): string {
  // Read package.json if present
  let pkg: PackageJson = {};
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJson;
    } catch {
      // ignore
    }
  }

  const projectName = pkg.name ?? basename(root);
  const description = pkg.description ?? '';

  // Detect frameworks
  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const nodeFrameworks = detectNodeFrameworks(allDeps);
  const pythonFrameworks = detectPythonFrameworks(root);
  const rustFrameworks = detectRustFrameworks(root);
  const goFrameworks = detectGoFrameworks(root);

  const detectedType = projectType !== 'unknown' ? projectType : detectProjectType(root);
  const frameworks = [...nodeFrameworks, ...pythonFrameworks, ...rustFrameworks, ...goFrameworks];

  // Build scripts section
  const scripts = pkg.scripts ? extractScripts(pkg.scripts) : [];

  const lines: string[] = [];

  // Header
  lines.push(`# ${projectName}`);
  if (description) lines.push('', description);
  lines.push('');

  // Tech stack
  lines.push('## Tech Stack');
  lines.push('');
  lines.push(`- **Language/Platform:** ${detectedType}`);
  if (frameworks.length > 0) {
    lines.push(`- **Frameworks/Libraries:** ${frameworks.join(', ')}`);
  }
  lines.push('');

  // Common commands
  if (scripts.length > 0) {
    lines.push('## Common Commands');
    lines.push('');
    lines.push('```bash');
    for (const [name, cmd] of scripts) {
      lines.push(`npm run ${name}   # ${cmd}`);
    }
    lines.push('```');
    lines.push('');
  } else {
    // Provide generic commands based on project type
    lines.push('## Common Commands');
    lines.push('');
    lines.push('```bash');
    if (detectedType === 'rust') {
      lines.push('cargo build         # build');
      lines.push('cargo test          # run tests');
      lines.push('cargo run           # run');
      lines.push('cargo clippy        # lint');
      lines.push('cargo fmt           # format');
    } else if (detectedType === 'go') {
      lines.push('go build ./...      # build');
      lines.push('go test ./...       # run tests');
      lines.push('go run .            # run');
      lines.push('go vet ./...        # lint');
      lines.push('gofmt -w .          # format');
    } else if (detectedType === 'python') {
      lines.push('python -m pytest    # run tests');
      lines.push('python -m mypy .    # type check');
      lines.push('ruff check .        # lint');
      lines.push('ruff format .       # format');
    } else if (detectedType === 'java') {
      lines.push('mvn compile         # build');
      lines.push('mvn test            # run tests');
      lines.push('mvn package         # package');
    } else if (detectedType === 'ruby') {
      lines.push('bundle exec rspec   # run tests');
      lines.push('bundle exec rubocop # lint');
    }
    lines.push('```');
    lines.push('');
  }

  // Preset-specific rules
  lines.push('## Claude Code Guidelines');
  lines.push('');

  if (preset === 'default') {
    lines.push('- Read relevant files before making changes');
    lines.push('- Keep changes minimal and focused on the task');
    lines.push('- Run tests after making changes');
    lines.push('- Ask before making large refactors');
    lines.push('');
    lines.push('## Notes');
    lines.push('');
    lines.push('<!-- Add project-specific notes for Claude here -->');
  } else if (preset === 'balanced') {
    lines.push('- Prefer editing existing files over creating new ones');
    lines.push('- Avoid reading test files and docs unless directly relevant');
    lines.push('- Batch related file reads where possible');
    lines.push('- Use /compact when context grows large');
    lines.push('- Keep responses concise — skip summaries of completed work');
    lines.push('');
    lines.push('## Architecture Notes');
    lines.push('');
    lines.push('<!-- Describe key architectural decisions and patterns here -->');
    lines.push('');
    lines.push('## Off-limits');
    lines.push('');
    lines.push(
      '<!-- List files or directories Claude should not modify without explicit instruction -->',
    );
  } else if (preset === 'aggressive') {
    lines.push('- Token budget is tight — minimize reads to essential files only');
    lines.push('- Do NOT read test files, docs, or fixtures unless explicitly asked');
    lines.push('- Do NOT read entire directories — target specific files');
    lines.push('- Use /compact proactively before context exceeds 50%');
    lines.push('- Skip all preamble and post-task summaries');
    lines.push('- No explanatory comments unless logic is non-obvious');
    lines.push('- Prefer single-pass solutions over iterative exploration');
    lines.push('');
    lines.push('## Critical Files');
    lines.push('');
    lines.push(
      '<!-- List the 5-10 most important files Claude should know about in this project -->',
    );
    lines.push('');
    lines.push('## Strict Off-limits');
    lines.push('');
    lines.push('<!-- Files Claude must NEVER modify -->');
  }

  lines.push('');

  return lines.join('\n');
}

// Keep backwards-compatible zero-arg export
export function generateClaudemd(): string {
  return generateClaudeMd(process.cwd(), 'unknown', 'default');
}
