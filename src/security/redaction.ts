/**
 * Masks sensitive values to ensure credentials are never exposed in terminal,
 * logs, test outputs, or reports.
 */
export function maskSecret(value: string): string {
  if (!value) return "";

  const trimmed = value.trim();

  // Multi-line private key blocks
  if (trimmed.includes("-----BEGIN") && trimmed.includes("KEY-----")) {
    const firstLine = trimmed.split("\n")[0];
    const lastLine = trimmed.split("\n").filter(Boolean).pop() || "-----END KEY-----";
    return `${firstLine}\n  [PRIVATE KEY CONTENT REDACTED]\n${lastLine}`;
  }

  // Database connection strings: postgres://user:password@host:port/db
  // Handle passwords that may contain special characters like '@'
  const urlCredRegex = /^([a-zA-Z0-9+.-]+:\/\/[^:]+:)(.*)(@[^@/\s]+(?::\d+)?(?:[/?#].*)?)$/;
  const match = trimmed.match(urlCredRegex);
  if (match) {
    return `${match[1]}********${match[3]}`;
  }

  // Token prefixes (e.g., ghp_, sk_live_, AKIA, glpat-)
  const knownPrefixes = [
    "ghp_",
    "gho_",
    "ghu_",
    "ghs_",
    "ghr_",
    "github_pat_",
    "glpat-",
    "xoxb-",
    "xoxp-",
    "xapp-",
    "sk_live_",
    "rk_live_",
    "sk_test_",
    "rk_test_",
    "AKIA",
    "ASIA",
    "ABIA"
  ];

  for (const prefix of knownPrefixes) {
    if (trimmed.startsWith(prefix)) {
      const rest = trimmed.slice(prefix.length);
      if (rest.length <= 4) {
        return `${prefix}****`;
      }
      const suffix = rest.slice(-4);
      return `${prefix}************${suffix}`;
    }
  }

  // Short values
  if (trimmed.length <= 8) {
    return "********";
  }

  // General masking: show first 3-4 chars and last 3-4 chars
  const leadLen = Math.min(4, Math.floor(trimmed.length / 4));
  const trailLen = Math.min(4, Math.floor(trimmed.length / 4));
  const lead = trimmed.slice(0, leadLen);
  const trail = trimmed.slice(-trailLen);

  return `${lead}************${trail}`;
}

/**
 * Returns true if a value is definitely an intentional placeholder or example,
 * preventing false-positive alerts on harmless examples.
 */
export function isPlaceholderOrExample(value: string): boolean {
  if (!value) return true;
  const lower = value.trim().toLowerCase();

  const placeholderExact = new Set([
    "your-api-key-here",
    "your-secret-key-here",
    "your-secret-here",
    "your-token-here",
    "your_api_key",
    "your_secret_key",
    "changeme",
    "change_me",
    "replace_me",
    "replaceme",
    "placeholder",
    "example",
    "sample",
    "dummy",
    "fake",
    "test",
    "development",
    "production",
    "localhost",
    "127.0.0.1",
    "none",
    "null",
    "undefined",
    "password",
    "secret",
    "admin",
    "root",
    "user",
    "todo",
    "xxx",
    "xxxx",
    "xxxxxx",
    "xxxxxxxx",
    "your-database-url",
    "postgres://user:password@localhost:5432/dbname",
    "https://example.com",
    "http://example.com",
    "user@example.com"
  ]);

  if (placeholderExact.has(lower)) {
    return true;
  }

  // Pattern matches for placeholders: <YOUR_...>, [YOUR_...], {YOUR_...}, your-...
  if (
    /^<.*>$/.test(lower) ||
    /^\[.*\]$/.test(lower) ||
    /^\{.*\}$/.test(lower) ||
    lower.startsWith("your-") ||
    lower.startsWith("your_") ||
    lower.startsWith("placeholder") ||
    lower.startsWith("insert_") ||
    lower.includes("dummy")
  ) {
    return true;
  }

  return false;
}
