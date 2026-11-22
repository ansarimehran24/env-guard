# Contributing to EnvGuardian

Thank you for helping improve EnvGuardian. Security-sensitive changes should be small, tested, and designed so raw environment values never appear in reports, errors, snapshots, or fixtures.

## Development setup

```bash
git clone https://github.com/adityaarora/envguardian.git
cd envguardian
npm ci
npm run check
```

Node.js 20 or 22 is recommended. Before opening a pull request, run:

```bash
npm run lint
npm run format:check
npm run test:coverage
npm pack --dry-run
```

## Pull requests

- Explain the user-facing behavior and security implications.
- Add regression tests for fixes and tests for new behavior.
- Do not include real credentials, copied tokens, private URLs, or customer data in fixtures.
- Preserve the public API unless the change is explicitly documented as breaking.
- Update the README and changelog when behavior changes.

## Reporting security problems

Follow [SECURITY.md](SECURITY.md). Do not disclose vulnerabilities or credentials in public issues.
