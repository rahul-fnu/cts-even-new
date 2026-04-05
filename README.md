# Project scaffolding: package.json, tsconfig, directory structure

## Overview

Initialize the `claude-token-saver` npm package with proper TypeScript setup.

**Repo:** [https://github.com/rahul-fnu/cts-new](<https://github.com/rahul-fnu/cts-new>)

Create a .gitignore with node_modules/, dist/, build/, \*.tgz, .env

## Requirements

### package.json

* name: `claude-token-saver`
* type: `module` (ESM)
* bin entries: `claude-token-saver` and `cts` both pointing to `./dist/index.js`
* dependencies: `commander` (CLI framework), `chalk` (colors), `ora` (spinners)
* devDependencies: `typescript`, `@types/node`
* engines: node >= 18

### tsconfig.json

* target: ES2022, module: Node16, moduleResolution: Node16
* strict: true, declaration: true
* outDir: ./dist, rootDir: ./src

### Directory structure

```
claude-token-saver/
├── src/
│   ├── index.ts          # CLI entry point (commander setup)
│   ├── commands/          # init, audit, generate, track
│   ├── generators/        # claudeignore, claudemd, settings, hooks
│   └── utils/             # scanner, tracker, display
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

### CLI entry point (src/index.ts)

* Shebang: `#!/usr/bin/env node`
* Register 4 commands via commander: `init`, `audit`, `generate`, `track`
* Each command imports from `./commands/`

## Acceptance criteria

* `npm run build` compiles successfully
* `node dist/index.js --help` shows all 4 commands
* `node dist/index.js --version` shows 1.0.0
* .gitignore exists and excludes node_modules/, dist/, build/, \*.tgz, .env
