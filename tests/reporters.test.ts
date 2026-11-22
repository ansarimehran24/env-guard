import { describe, it, expect } from "vitest";
import {
  formatDiagnostics,
  formatScanSummary,
  formatCompareReport,
  formatValidationReport
} from "../src/reporters/console.js";
import { formatJsonReport, formatValidationJsonReport } from "../src/reporters/json.js";
import { formatSarifReport } from "../src/reporters/sarif.js";
import type { Diagnostic } from "../src/types/diagnostic.js";

describe("Reporters", () => {
  const sampleDiags: Diagnostic[] = [
    {
      ruleId: "secret/aws-access-key-id",
      message: "Potential AWS Access Key ID detected",
      severity: "error",
      confidence: "HIGH",
      file: ".env",
      line: 3,
      column: 1,
      variableName: "AWS_KEY",
      maskedValue: "AKIA************MPLE",
      remediation: "Revoke AWS key"
    },
    {
      ruleId: "syntax/suspicious-whitespace",
      message: "Suspicious whitespace around '='",
      severity: "warning",
      file: ".env",
      line: 7,
      column: 5
    }
  ];

  it("should format console diagnostics with badges and masked values", () => {
    const formatted = formatDiagnostics(sampleDiags);
    expect(formatted).toContain("ERROR");
    expect(formatted).toContain("WARN");
    expect(formatted).toContain(".env:3:1");
    expect(formatted).toContain("AKIA************MPLE");
    expect(formatted).toContain("Revoke AWS key");
  });

  it("should format scan summary correctly", () => {
    const summary = formatScanSummary({
      valid: false,
      filesScanned: 2,
      variablesAnalyzed: 10,
      diagnostics: sampleDiags,
      summary: { errors: 1, warnings: 1, infos: 0 }
    });
    expect(summary).toContain("Scan Complete: FAILED");
    expect(summary).toContain("Files scanned: 2");
    expect(summary).toContain("1 error, 1 warning");
  });

  it("should format JSON output cleanly", () => {
    const jsonStr = formatJsonReport({ test: 123 });
    const parsed = JSON.parse(jsonStr);
    expect(parsed.test).toBe(123);
  });

  it("should never expose validated environment data or secret validation values", () => {
    const result = {
      valid: false,
      data: { DATABASE_PASSWORD: "super-secret-password", SAFE_PORT: 3000 },
      errors: [
        {
          key: "DATABASE_PASSWORD",
          message: "Password is too short",
          received: "super-secret-password"
        }
      ],
      warnings: []
    };

    const consoleReport = formatValidationReport(result);
    const jsonReport = formatValidationJsonReport(result);

    expect(consoleReport).not.toContain("super-secret-password");
    expect(jsonReport).not.toContain("super-secret-password");
    expect(JSON.parse(jsonReport)).not.toHaveProperty("data");
  });

  it("should format valid SARIF 2.1.0 output with schema and rules", () => {
    const sarifStr = formatSarifReport(sampleDiags);
    const parsed = JSON.parse(sarifStr);
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.$schema).toContain("sarif-schema-2.1.0.json");
    expect(parsed.runs[0].tool.driver.name).toBe("EnvGuardian");
    expect(parsed.runs[0].results).toHaveLength(2);
    expect(parsed.runs[0].results[0].level).toBe("error");
    expect(parsed.runs[0].results[0].locations[0].physicalLocation.region.startLine).toBe(3);
  });

  it("should format compare and validation reports", () => {
    const compFormatted = formatCompareReport({
      sourceFile: ".env.example",
      targetFile: ".env",
      missingInTarget: ["SECRET_KEY"],
      extraInTarget: ["EXTRA_DEBUG"],
      emptyInTarget: [],
      typeMismatches: [],
      duplicateKeys: { source: [], target: [] },
      identicalCount: 5,
      totalKeysSource: 6,
      totalKeysTarget: 6,
      valid: false
    });
    expect(compFormatted).toContain("Comparing .env.example and .env");
    expect(compFormatted).toContain("Missing variables");
    expect(compFormatted).toContain("Extra variables");

    const valFormatted = formatValidationReport({
      valid: false,
      data: {},
      errors: [{ key: "PORT", message: "Must be a number" }],
      warnings: [{ key: "NODE_ENV", message: "Consider setting NODE_ENV" }]
    });
    expect(valFormatted).toContain("Validation Errors (1)");
    expect(valFormatted).toContain("Validation Warnings (1)");
  });
});
