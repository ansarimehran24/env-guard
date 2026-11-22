import type { Diagnostic, ConfidenceLevel, DiagnosticSeverity } from "../types/diagnostic.js";
import { maskSecret, isPlaceholderOrExample } from "./redaction.js";
import { isHighEntropy } from "../utils/entropy.js";

export interface SecretPatternRule {
  id: string;
  name: string;
  regex: RegExp;
  confidence: ConfidenceLevel;
  severity?: DiagnosticSeverity;
  remediation: string;
}

export const BUILTIN_SECRET_RULES: SecretPatternRule[] = [
  {
    id: "aws-access-key-id",
    name: "AWS Access Key ID",
    regex: /\b(AKIA|ASIA|ABIA)[0-9A-Z]{16}\b/,
    confidence: "HIGH",
    remediation:
      "Revoke the AWS access key in AWS IAM Console and replace with IAM roles or an environment secret."
  },
  {
    id: "github-token",
    name: "GitHub Personal Access Token",
    regex: /\b(gh[pousr]_[A-Za-z0-9_]{36,255}|github_pat_[A-Za-z0-9_]{82})\b/,
    confidence: "HIGH",
    remediation:
      "Revoke and regenerate the GitHub token from your GitHub Account Settings -> Developer Settings."
  },
  {
    id: "gitlab-token",
    name: "GitLab Personal Access Token",
    regex: /\bglpat-[0-9a-zA-Z\-_]{20,250}\b/,
    confidence: "HIGH",
    remediation: "Revoke and rotate the GitLab token from User Settings -> Access Tokens."
  },
  {
    id: "slack-token",
    name: "Slack API Token",
    regex: /\bxox[baprs]-[0-9]{10,14}-[0-9]{10,14}-[a-zA-Z0-9]{20,40}\b/,
    confidence: "HIGH",
    remediation: "Revoke the Slack token via api.slack.com/apps and reinstall the application."
  },
  {
    id: "stripe-live-key",
    name: "Stripe Live Secret Key",
    regex: /\b(sk_live|rk_live)_[0-9a-zA-Z]{24,99}\b/,
    confidence: "HIGH",
    remediation:
      "Roll this Stripe secret key immediately in the Stripe Dashboard to prevent unauthorized charges."
  },
  {
    id: "stripe-test-key",
    name: "Stripe Test Secret Key",
    regex: /\b(sk_test|rk_test)_[0-9a-zA-Z]{24,99}\b/,
    confidence: "MEDIUM",
    remediation: "Although this is a test key, avoid committing it to public source repositories."
  },
  {
    id: "private-key-block",
    name: "Private Key Block",
    regex: /-----BEGIN[ A-Z0-9_-]*KEY-----/,
    confidence: "HIGH",
    remediation:
      "Never store private keys in versioned environment files. Use a secrets manager (Vault, AWS Secrets Manager, etc.)."
  },
  {
    id: "db-connection-password",
    name: "Database Connection String with Embedded Password",
    regex:
      /(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^:\s'"]+:([^@\s'"]+)@[^/\s'"]+/,
    confidence: "HIGH",
    remediation:
      "Avoid hardcoding plain database passwords in connection URLs. Use separate secret injection or managed identity."
  },
  {
    id: "jwt-token",
    name: "JSON Web Token (JWT)",
    regex: /\beyJ[A-Za-z0-9-_]{10,}\.eyJ[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}\b/,
    confidence: "MEDIUM",
    remediation:
      "JWTs may grant authenticated user or administrative sessions. Rotate the signing key and invalidate active tokens."
  }
];

export interface DetectSecretOptions {
  customRules?: SecretPatternRule[];
  minEntropy?: number;
  excludePlaceholders?: boolean;
}

/**
 * Scans a key-value pair or raw text line for secrets.
 */
export function detectSecrets(
  key: string,
  value: string,
  location?: { file?: string; line?: number; column?: number },
  options: DetectSecretOptions = {}
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (!value || typeof value !== "string") return diagnostics;

  const trimmed = value.trim();
  if (trimmed.length === 0) return diagnostics;

  const shouldExclude = options.excludePlaceholders ?? true;
  if (shouldExclude && isPlaceholderOrExample(trimmed)) {
    return diagnostics;
  }

  const rules = [...BUILTIN_SECRET_RULES, ...(options.customRules || [])];

  // 1. Check known regex rules first
  for (const rule of rules) {
    rule.regex.lastIndex = 0;
    if (rule.regex.test(trimmed)) {
      diagnostics.push({
        ruleId: `secret/${rule.id}`,
        message: `Potential ${rule.name} detected`,
        severity: rule.severity ?? (rule.confidence === "HIGH" ? "error" : "warning"),
        confidence: rule.confidence,
        file: location?.file,
        line: location?.line,
        column: location?.column,
        variableName: key,
        maskedValue: maskSecret(trimmed),
        remediation: rule.remediation
      });
      // One high-confidence match per key is sufficient
      return diagnostics;
    }
  }

  // 2. High-entropy heuristic check for keys implying credentials
  const keyUpper = key.toUpperCase();
  const impliesSecret = [
    "SECRET",
    "PASSWORD",
    "TOKEN",
    "KEY",
    "AUTH",
    "API_KEY",
    "PRIVATE",
    "CREDENTIAL"
  ].some((term) => keyUpper.includes(term));

  const entropyThreshold = options.minEntropy ?? 3.8;
  if (impliesSecret && trimmed.length >= 24 && isHighEntropy(trimmed, entropyThreshold)) {
    diagnostics.push({
      ruleId: "secret/high-entropy-credential",
      message: `Suspicious high-entropy value detected for credential variable "${key}"`,
      severity: "warning",
      confidence: "MEDIUM",
      file: location?.file,
      line: location?.line,
      column: location?.column,
      variableName: key,
      maskedValue: maskSecret(trimmed),
      remediation:
        "Ensure this credential is not a live production secret checked into your repository."
    });
  }

  return diagnostics;
}
