# Lumen

<p align="center">
  <img src="./assets/yf-labs-logo.svg" alt="YF Labs" width="380" />
</p>

<p align="center">
  <img src="./assets/icon.svg" alt="YF Labs" width="20" height="20" style="vertical-align: -3px;" />
  <b>Lumen CLI is under active development by <a href="https://github.com/firmansyf">YF Labs</a></b><br>
  <sub>Illuminate your code. Developer project health, diagnostics, and security analysis.</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Under%20Development-blue" alt="Status: Under Development" />
  <img src="https://img.shields.io/badge/Developed%20by-YF%20Labs-indigo" alt="Developed by YF Labs" />
  <img src="https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen" alt="Node.js >= 20" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License: MIT" />
</p>

---

> Illuminate your code.

📖 **Usage guide:** [yflabstudio.com/docs/products/lumen-cli](https://yflabstudio.com/docs/products/lumen-cli)

Lumen is a developer project health and diagnostics CLI that helps you find potential problems before shipping.

It checks your project for:

- Project configuration
- Dependency updates
- Known security vulnerabilities
- Hardcoded secrets
- Environment configuration issues

## Quick Start

Run Lumen without installing it globally:

```bash
npx lumen-cli scan
```

That's it. Lumen scans the current project and reports detected issues.

## Requirements

- Node.js 20 or newer
- npm

Check your versions:

```bash
node --version
npm --version
```

## Installation

### Use with npx — recommended

```bash
npx lumen-cli scan
```

Scan another project:

```bash
npx lumen-cli scan ./my-project
```

### Install globally

```bash
npm install -g lumen-cli
```

Then:

```bash
lumen scan
```

Check the version:

```bash
lumen --version
```

## What Lumen Checks

### Project

Checks basic project configuration, including `package.json`, Git, and TypeScript configuration.

### Dependencies

Checks installed npm dependencies for:

- Available updates
- Major, minor, and patch updates
- Missing dependencies

### Security

Checks installed npm dependencies against the OSV vulnerability database and reports available vulnerability information such as CVE, severity, installed version, and fixed version.

### Secret Detection

Scans project files for potential hardcoded secrets such as API keys, JWT tokens, private keys, and other known credential patterns.

> Secret detection is pattern-based, so results should be reviewed for possible false positives.

### Environment

Checks environment variable usage and configuration patterns to help identify missing or potentially unsafe environment configuration.

## Basic Usage

Scan the current project:

```bash
npx lumen-cli scan
```

Scan another project:

```bash
npx lumen-cli scan ./path/to/project
```

Example output:

```text
Lumen
Illuminate your code.

Scanning: /home/user/my-project

Project
──────────────────────────────
✓ package.json detected
✓ Git repository detected
✓ TypeScript detected

Dependency
──────────────────────────────
✓ Dependencies detected
⚠ react has a minor update available

Security
──────────────────────────────
✓ No vulnerabilities found

Secrets
──────────────────────────────
✓ No secrets detected

Environment
──────────────────────────────
✓ Environment checks passed

──────────────────────────────
0 errors · 1 warnings · 6 info
```

## JSON Output

Use JSON output for CI/CD pipelines and automation:

```bash
npx lumen-cli scan --json
```

Example:

```json
{
  "tool": "lumen",
  "version": "0.1.2",
  "scannedPath": ".",
  "summary": {
    "total": 3,
    "errors": 1,
    "warnings": 1,
    "infos": 1
  },
  "issues": []
}
```

## Configuration

Lumen works without configuration. If you need to customize scanning, create `lumen.config.ts` in the root of your project.

Example:

```ts
export default {
  ignore: [
    "fixtures/",
    "generated/"
  ],
  failOn: "error",
  dependency: {
    checkUpdates: true
  },
  security: {
    enabled: true
  },
  environment: {
    enabled: true
  }
};
```

### `ignore`

Exclude additional files or directories from scanning:

```ts
export default {
  ignore: [
    "fixtures/",
    "generated/",
    "mock-data/"
  ]
};
```

### `failOn`

Controls when Lumen returns a failing exit code:

- `error` — fail only when errors are detected (default)
- `warning` — fail when warnings or errors are detected
- `none` — report issues without failing

Example:

```ts
export default {
  failOn: "warning"
};
```

### Disable specific checks

Dependency updates, security checks, and environment checks can be disabled when needed:

```ts
export default {
  dependency: {
    checkUpdates: false
  },
  security: {
    enabled: false
  },
  environment: {
    enabled: false
  }
};
```

## Ignoring Files with `.lumenignore`

Create a `.lumenignore` file in your project root to exclude files or directories from scanning:

```text
src/tests/
tests/
fixtures/
generated/
mock-data/
```

Lumen already ignores common generated and dependency directories such as:

```text
node_modules/
.git/
dist/
build/
.next/
.expo/
coverage/
.cache/
```

Common lockfiles are also ignored by default:

```text
package-lock.json
pnpm-lock.yaml
yarn.lock
```

## Exit Codes

Lumen can be used in CI/CD because its exit code can be configured with `failOn`.

| `failOn` | Errors | Warnings | Result |
|---|---|---|---|
| `error` | Fail | Pass | Fails only when errors exist |
| `warning` | Fail | Fail | Fails when warnings or errors exist |
| `none` | Pass | Pass | Always passes |

Default:

```ts
failOn: "error"
```

## GitHub Actions & CI/CD

Lumen is designed to integrate into CI/CD pipelines to catch issues before shipping code.

### Sample Workflow

Create `.github/workflows/lumen.yml` in your repository:

```yaml
name: Lumen CI

on:
  push:
    branches:
      - main
      - master
  pull_request:
    branches:
      - main
      - master

permissions:
  contents: read

jobs:
  build-and-scan:
    name: Build, Test & Scan
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [20, 22]

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10
          run_install: false

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run test suite
        run: pnpm test

      - name: Build project
        run: pnpm build

      # On Pull Requests: scan only files changed compared to base branch
      - name: Scan PR changed files for secrets
        if: github.event_name == 'pull_request'
        run: node dist/index.js scan --changed --base origin/${{ github.base_ref }}

      # Run full project health scan
      - name: Run full Lumen scan
        run: node dist/index.js scan
```

### Scanning in External Projects (via npx / pnpm dlx)

For projects using Lumen without adding it as a local dependency:

```yaml
- name: Run Lumen Scan
  run: npx lumen-cli scan

# Machine-readable output for automations
- name: Run Lumen Scan (JSON)
  run: npx lumen-cli scan --json
```

### Pull Request Changed Files Comparison

On pull requests, `git status` sees a clean working tree because the PR commits are already committed. Use `--base` to compare against the target branch:

```bash
lumen scan --changed --base origin/main
```

> [!NOTE]
> Ensure your checkout action uses `fetch-depth: 0` so Git can access the base branch history for three-dot diff comparison (`origin/main...HEAD`).

### Security & Privacy in CI/CD

- **Zero Secret Exposure:** Lumen's secret scanner detects potential hardcoded credentials using pattern matching, but **never prints, logs, or exports the actual secret values** to the terminal, logs, or JSON outputs.
- **Environment Privacy:** Lumen scans `.env` variable names to ensure they are documented in `.env.example`, but **never reads, logs, or transmits the secret values** inside `.env`.
- **Least Privilege:** The workflow requires only `contents: read` permissions.

### Troubleshooting CI

#### 1. `Cannot compare against base 'origin/main'`
- **Cause:** `actions/checkout` defaults to shallow clone (`fetch-depth: 1`), meaning `origin/main` is not present in local refs.
- **Fix:** Set `fetch-depth: 0` on `actions/checkout@v4`.

#### 2. Workflow fails on warnings
- **Cause:** The default `failOn` is `"error"`, but your `lumen.config.ts` might be configured to `failOn: "warning"`.
- **Fix:** Review reported warnings or configure `failOn: "error"` in `lumen.config.ts`.

#### 3. Network Timeouts or Rate Limits
- **Behavior:** Lumen includes built-in timeouts (5000ms) and automatic retry with exponential backoff for OSV and npm registry rate limits (HTTP 429 / 503). If network access is completely disabled in a sandboxed CI runner, network checks will fail gracefully without crashing other analyzers.

## CLI Reference

### Scan current project

```bash
npx lumen-cli scan
```

### Scan specific directory

```bash
npx lumen-cli scan ./path/to/project
```

### Scan changed Git files only (secrets check)

```bash
# Scan uncommitted / untracked working tree changes
npx lumen-cli scan --changed

# Scan changes compared to a base branch (e.g. in PRs)
npx lumen-cli scan --changed --base origin/main
```

### JSON output for CI / tooling

```bash
npx lumen-cli scan --json
```

### Initialize configuration

```bash
npx lumen-cli init
```

### Show version & help

```bash
npx lumen-cli --version
npx lumen-cli -v
npx lumen-cli --help
```

## <img src="./assets/icon.svg" alt="YF Labs" width="22" height="22" style="vertical-align: -3px;" /> About YF Labs

Lumen CLI is engineered under **YF Labs** (Research & Developer Tooling) by Yusuf Firmansyah, focused on crafting modern, high-performance developer tools with exceptional developer experience.

## License

MIT License

Copyright (c) 2026 Yusuf Firmansyah

See the `LICENSE` file for the full license text.
