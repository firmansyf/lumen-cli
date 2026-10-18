# Changelog

All notable changes to Lumen CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Git-Aware Scanning (`--changed` and `--base <ref>`)**:
  - Incremental scanning for changed and untracked files in Git repositories.
  - Pull Request comparison support against target base branches (e.g. `origin/main`).
  - Null-byte separated parsing (`-z`) for safe handling of filenames with spaces, renames, and special characters.
  - Path traversal protection and toplevel Git working tree isolation.
- **Developer Experience (DX) Enhancements**:
  - Direct clickable file:line locations in modern terminals (e.g. `File: path/to/file.ts:42`).
  - Flag `-v` shorthand for displaying the version number.
  - Graceful default help screen display when running `lumen` without subcommands.
  - Actionable remediation messages for missing directories, Git errors, and invalid configurations.
  - ISO-8601 `timestamp` and `success` boolean fields added to `--json` output format.
  - Dual binary entry points (`lumen` and `lumen-cli`).
  - Proper package exports (`exports`, `main`, `types`) and metadata links (`bugs`, `homepage`).
- **Branding & Visuals**:
  - YF Labs official SVG icon (`assets/icon.svg`) and branding banner (`assets/yf-labs-logo.svg`).
  - Added YF Labs development attribution and status badges in `README.md`.
- **CI/CD Integration**:
  - GitHub Actions workflow (`.github/workflows/lumen.yml`) with Node.js 20 & 22 matrix, frozen pnpm lockfile, and least-privilege security permissions.
- **Analyzer Resilience**:
  - Network timeouts (5000ms) and automatic retry with exponential backoff on HTTP 429 and 503 for OSV and npm registry APIs.
  - Concurrency limits for OSV and npm queries to eliminate rate limiting.
  - Graceful error isolation so analyzer failures do not suppress other diagnostic results.
  - Support for `workspace:*`, `file:`, and `link:` dependency protocols.

### Changed
- Streamlined terminal output to remove redundant dependency versions and highlight suggested fixes with cyan indicator arrows.
- Standardized `failOn` severity validation with fallback warnings.

### Fixed
- Fixed directory walking in secret and environment analyzers when scanning root directories.
- Added missing `file: "package.json"` property to missing package.json diagnostic issues.
- Fixed vulnerability severity mapping for advisories lacking standard CVSS scores.

---

## [0.1.4] - 2026-09-28
- Added environment variable analyzer.
- Added JSON output support.
- Initial public release on npm.
