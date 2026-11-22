# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and semantic versioning.

## [Unreleased]

### Added

- Release documentation, security policy, license, and JSON configuration schema.
- Contributor guidance and complete npm repository metadata.
- Built-in TypeScript configuration loading.
- Nuxt and Gatsby public-variable exposure detection.
- Secret-safe CLI validation reports that omit environment data and mask sensitive invalid values.

### Changed

- Enforced minimum coverage thresholds of 80% statements/lines, 70% branches, and 90% functions.
- Removed unused runtime dependencies and updated the test toolchain to audited versions.

### Fixed

- Avoided an extra trailing blank line when generating `.env.example` files.

## [1.0.0] - 2026-11-22

### Added

- Typed environment validation with defaults, coercion, constraints, and custom validators.
- Secret, entropy, dotenv syntax, duplicate-key, and public-framework exposure scanning.
- Environment comparison, Git safety checks, project doctor, safe example generation, and initialization commands.
- Text, JSON, and SARIF reporting.
- ESM, CommonJS, and TypeScript declaration builds.
- Cross-platform Node.js 20/22 CI and automated tests.
