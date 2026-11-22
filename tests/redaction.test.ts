import { describe, it, expect } from "vitest";
import { maskSecret } from "../src/security/redaction.js";

describe("maskSecret", () => {
  it("should mask database connection strings without leaking the password", () => {
    const raw = "postgres://root:p@ssw0rd123@localhost:5432/app";
    const masked = maskSecret(raw);
    expect(masked).toBe("postgres://root:********@localhost:5432/app");
    expect(masked).not.toContain("p@ssw0rd123");
  });

  it("should mask known token prefixes keeping prefix and suffix only", () => {
    const ghToken = "ghp_1234567890abcdefghijklmnopqrstuvwxyz9999";
    const maskedGh = maskSecret(ghToken);
    expect(maskedGh).toBe("ghp_************9999");
    expect(maskedGh).not.toContain("1234567890abcdef");

    const stripeKey = ["sk", "live", "1234567890abcdefghijklmnopqrstuv8888"].join("_");
    const maskedStripe = maskSecret(stripeKey);
    expect(maskedStripe).toBe("sk_live_************8888");

    const awsKey = "AKIA1234567890EXAMPLE";
    const maskedAws = maskSecret(awsKey);
    expect(maskedAws).toBe("AKIA************MPLE");
  });

  it("should redact private key blocks completely", () => {
    const privKey = `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDp\n-----END PRIVATE KEY-----`;
    const masked = maskSecret(privKey);
    expect(masked).toContain("[PRIVATE KEY CONTENT REDACTED]");
    expect(masked).not.toContain("MIIEvgIBADANBg");
  });

  it("should handle short secrets with full asterisks", () => {
    expect(maskSecret("secret")).toBe("********");
    expect(maskSecret("12345")).toBe("********");
  });

  it("should handle empty or null values gracefully", () => {
    expect(maskSecret("")).toBe("");
  });
});
