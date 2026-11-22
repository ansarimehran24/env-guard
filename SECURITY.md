# Security policy

## Supported versions

Security fixes are provided for the latest published major version. Before the first public release, fixes are applied to the default branch.

## Reporting a vulnerability

Do not open a public issue containing credentials, exploit details, private repository data, or other sensitive material. Contact the package maintainers privately through the security-reporting channel configured on the eventual source repository. If no private channel is available, open a minimal public issue requesting a private contact method without including vulnerability details.

Include the affected version, impact, reproduction steps, and a suggested mitigation when possible. Maintainers should acknowledge a report within seven days and coordinate disclosure after a fix is available.

## Scope and limitations

EnvGuardian uses pattern matching and entropy heuristics. False positives and false negatives are possible. It does not replace a secret manager, repository history scanner, dependency audit, or credential rotation. Treat any credential committed to Git as compromised even after the file is removed.
