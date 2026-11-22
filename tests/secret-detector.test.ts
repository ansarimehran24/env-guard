import { describe, it, expect } from "vitest";
import { detectSecrets } from "../src/security/secret-detector.js";
import { scanEnv } from "../src/core/scanner.js";

describe("detectSecrets", () => {
  it("should detect synthetic AWS Access Key IDs", () => {
    const diags = detectSecrets("AWS_ACCESS_KEY_ID", "AKIAIOSFODNN7EXAMPLE");
    expect(diags).toHaveLength(1);
    expect(diags[0].ruleId).toBe("secret/aws-access-key-id");
    expect(diags[0].confidence).toBe("HIGH");
    expect(diags[0].maskedValue).toBe("AKIA************MPLE");
    expect(diags[0].maskedValue).not.toContain("IOSFODNN7");
  });

  it("should detect synthetic GitHub personal access tokens", () => {
    const fakeGhToken = "ghp_1234567890abcdefghijklmnopqrstuvwxyz1234";
    const diags = detectSecrets("GITHUB_TOKEN", fakeGhToken);
    expect(diags).toHaveLength(1);
    expect(diags[0].ruleId).toBe("secret/github-token");
    expect(diags[0].confidence).toBe("HIGH");
    expect(diags[0].maskedValue).toBe("ghp_************1234");
    expect(diags[0].maskedValue).not.toContain("abcdefghijkl");
  });

  it("should detect synthetic GitLab personal access tokens", () => {
    const fakeGlToken = "glpat-abcdef123456789012345678";
    const diags = detectSecrets("GITLAB_TOKEN", fakeGlToken);
    expect(diags).toHaveLength(1);
    expect(diags[0].ruleId).toBe("secret/gitlab-token");
  });

  it("should detect synthetic Slack API tokens", () => {
    const fakeSlack = ["xoxb", "123456789012", "123456789012", "abcdefghijklmnopqrstuv12"].join("-");
    const diags = detectSecrets("SLACK_BOT_TOKEN", fakeSlack);
    expect(diags).toHaveLength(1);
    expect(diags[0].ruleId).toBe("secret/slack-token");
  });

  it("should detect synthetic Stripe Live secret keys", () => {
    const fakeStripe = ["sk", "live", "1234567890abcdefghijklmnopqrstuv"].join("_");
    const diags = detectSecrets("STRIPE_SECRET_KEY", fakeStripe);
    expect(diags).toHaveLength(1);
    expect(diags[0].ruleId).toBe("secret/stripe-live-key");
    expect(diags[0].severity).toBe("error");
  });

  it("should detect private key blocks", () => {
    const fakeKey = `-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0fakekeydata...\n-----END RSA PRIVATE KEY-----`;
    const diags = detectSecrets("PRIVATE_KEY", fakeKey);
    expect(diags).toHaveLength(1);
    expect(diags[0].ruleId).toBe("secret/private-key-block");
    expect(diags[0].maskedValue).toContain("[PRIVATE KEY CONTENT REDACTED]");
  });

  it("should detect database URLs with embedded passwords", () => {
    const dbUrl = "postgres://admin:superSecretPass123@db.example.com:5432/production";
    const diags = detectSecrets("DATABASE_URL", dbUrl);
    expect(diags).toHaveLength(1);
    expect(diags[0].ruleId).toBe("secret/db-connection-password");
    expect(diags[0].maskedValue).toBe("postgres://admin:********@db.example.com:5432/production");
    expect(diags[0].maskedValue).not.toContain("superSecretPass123");
  });

  it("should detect synthetic JSON Web Tokens (JWT)", () => {
    const fakeJwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const diags = detectSecrets("AUTH_JWT", fakeJwt);
    expect(diags).toHaveLength(1);
    expect(diags[0].ruleId).toBe("secret/jwt-token");
  });

  it("should detect high-entropy credentials with generic names", () => {
    const highEntropy = "b7f9a2c4e6d8a1f3c5e7b9d2a4f6c8e0";
    const diags = detectSecrets("APP_ENCRYPTION_SECRET", highEntropy);
    expect(diags).toHaveLength(1);
    expect(diags[0].ruleId).toBe("secret/high-entropy-credential");
  });

  it("should NOT flag harmless test placeholders or examples", () => {
    const harmlessExamples = [
      "your-api-key-here",
      "your-secret-here",
      "changeme",
      "change_me",
      "placeholder",
      "example",
      "test",
      "localhost",
      "development",
      "your_token_here",
      "<YOUR_API_KEY>",
      "your-github-token-here"
    ];

    for (const val of harmlessExamples) {
      const diags = detectSecrets("API_KEY", val);
      expect(diags).toHaveLength(0);
    }
  });
});

describe("custom secret rules", () => {
  it("supports string patterns from JSON configuration", () => {
    const result = scanEnv([{ path: ".env.custom", content: "INTERNAL_TOKEN=corp_1234567890\n" }], {
      customRules: [
        {
          id: "corporate-token",
          name: "Corporate token",
          pattern: "^corp_[0-9]{10}$",
          severity: "error",
          remediation: "Rotate the corporate token."
        }
      ]
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({
      ruleId: "secret/corporate-token",
      confidence: "HIGH"
    });
    expect(result.diagnostics[0].maskedValue).not.toBe("corp_1234567890");
  });

  it("reports invalid custom regular expressions without crashing", () => {
    const result = scanEnv([{ path: ".env.custom", content: "VALUE=safe\n" }], {
      customRules: [{ id: "broken", name: "Broken rule", pattern: "[" }]
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics[0].ruleId).toBe("config/invalid-secret-rule");
  });
});
