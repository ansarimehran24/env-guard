# EnvGuardian

EnvGuardian is a TypeScript-first environment variable validator and security scanner for Node.js. It validates typed configuration, detects likely credentials, checks Git safety, compares environment files without printing their values, and produces CI-friendly JSON or SARIF reports.

> Status: release candidate for `1.0.0`. The unscoped name `envguardian` returned `404 Not Found` from the public npm registry when checked on 22 November 2026. Registry availability is not a reservation and must be checked again immediately before publishing.

## Requirements

- Node.js 20 or newer
- npm 10 or another compatible package manager

## Install

```bash
npm install --save-dev envguardian
```

Until the first registry release, build and link a local checkout:

```bash
npm ci
npm run build
npm link
envguardian --help
```

## Quick start

```bash
npx envguardian init --yes
npx envguardian scan
npx envguardian validate
npx envguardian doctor
```

`init` creates `envguardian.config.json`, safely generates `.env.example` when possible, and adds useful npm scripts. Review generated rules before using them in production.

## Configuration

EnvGuardian looks for these files in order:

1. `envguardian.config.ts`
2. `envguardian.config.js`
3. `envguardian.config.mjs`
4. `envguardian.config.json`
5. `.envguardianrc.json`

TypeScript, JavaScript, MJS, and JSON configuration files work directly; EnvGuardian bundles the TypeScript configuration loader.

```json
{
  "$schema": "./node_modules/envguardian/schema.json",
  "files": [".env", ".env.production"],
  "strict": true,
  "schema": {
    "DATABASE_URL": { "type": "url", "required": true },
    "PORT": { "type": "port", "default": 3000 },
    "NODE_ENV": {
      "type": "enum",
      "values": ["development", "test", "production"],
      "default": "development"
    },
    "FEATURE_ENABLED": { "type": "boolean", "default": false }
  },
  "scan": {
    "secrets": true,
    "frameworkSafety": true,
    "minEntropy": 3.8
  }
}
```

Supported types are `string`, `nonempty_string`, `number`, `integer`, `port`, `boolean`, `url`, `email`, `enum`, and `json`. Rules can also define `minLength`, `maxLength`, `min`, `max`, `regex`, `values`, and, in JavaScript configuration, a `custom` validator.

## CLI

### Scan environment files

```bash
envguardian scan --file .env
envguardian scan --format json --output envguardian-report.json
envguardian scan --format sarif --output envguardian.sarif
envguardian scan --staged --strict
```

The scanner checks dotenv syntax, duplicate keys, common secret formats, high-entropy credential-like values, and unsafe public framework prefixes such as `NEXT_PUBLIC_` and `VITE_`. Detected values are masked.

### Validate a schema

```bash
envguardian validate --config envguardian.config.json
envguardian validate --file .env.production --strict
```

Validation coerces supported types and never mutates `process.env`. CLI JSON reports intentionally omit the validated `data` object so secrets are not written to logs or CI artifacts.

### Compare environments

```bash
envguardian compare .env.example .env
envguardian compare .env.staging .env.production --strict
```

Comparison reports missing, extra, empty, duplicate, and likely type-mismatched keys without displaying their values.

### Audit project health and Git safety

```bash
envguardian doctor
envguardian git-check --staged
```

### Generate a safe example

```bash
envguardian generate-example --file .env --output .env.example
```

Use `--force` only when you intend to replace an existing example file.

## Programmatic API

```ts
import { defineConfig, scanEnv, validateEnv } from "envguardian";

const schema = {
  DATABASE_URL: { type: "url", required: true },
  PORT: { type: "port", default: 3000 }
} as const;

const validation = validateEnv(process.env, schema);
if (!validation.valid) {
  console.error(validation.errors);
  process.exitCode = 1;
}

const scan = scanEnv([".env"]);
console.log(scan.valid, scan.summary);

export default defineConfig({ schema });
```

The package exposes ESM, CommonJS, and TypeScript declaration builds. Other exports include `compareEnv`, `generateEnvExample`, `parseEnvContent`, `runDoctor`, `checkGitSafety`, `detectSecrets`, console/JSON/SARIF reporters, and the public result types.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Checks passed |
| `1` | Validation or security findings failed the requested policy |
| `2` | Usage, configuration, or file error |

## Security model

EnvGuardian is a detection and validation layer, not a secret manager. A clean scan does not prove a value is safe. Store production credentials in a managed secret store, rotate any exposed credential, keep `.env` files out of Git, and review SARIF/JSON artifacts before sharing them.

See [SECURITY.md](SECURITY.md) for reporting and disclosure guidance.

## Development

```bash
npm ci
npm run check
npm run lint
npm run format:check
npm run test:coverage
npm pack --dry-run
```

The CI matrix covers Node.js 20 and 22 on Linux, macOS, and Windows.
Coverage gates require at least 80% statements and lines, 70% branches, and 90% functions.

## License

MIT
