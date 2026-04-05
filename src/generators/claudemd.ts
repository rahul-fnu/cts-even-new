export function generateClaudemd(): string {
  return `# Project Guidelines for Claude

## Project Overview
<!-- Describe what this project does and its primary purpose -->

## Architecture
<!-- Describe the high-level architecture, key directories, and how the pieces fit together -->

## Development Setup
<!-- List the commands needed to build, test, and run the project -->
\`\`\`bash
# Install dependencies
# npm install

# Run tests
# npm test

# Build
# npm run build
\`\`\`

## Key Conventions
<!-- List coding conventions, naming patterns, and style rules specific to this project -->
-
-

## Important Files
<!-- List files that are critical to understand, with a one-line description -->
-

## Out of Scope
<!-- List areas Claude should NOT modify without explicit instruction -->
-

## Testing
<!-- Describe the testing strategy and how to run tests -->

## Notes
<!-- Any other project-specific guidance -->
`;
}
