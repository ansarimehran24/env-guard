import pc from "picocolors";
import type { Diagnostic, ScanResult } from "../types/diagnostic.js";
import type { CompareResult, GitSafetyResult, DoctorReport } from "../types/index.js";
import type { ValidationResult } from "../types/schema.js";
import { maskSecret } from "../security/redaction.js";

const SENSITIVE_KEY_PATTERN =
  /(?:SECRET|PASSWORD|PASSWD|TOKEN|API[_-]?KEY|PRIVATE[_-]?KEY|CREDENTIAL|AUTH|COOKIE|SESSION)/i;

export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) {
    return pc.green("✔ No issues or security vulnerabilities detected.");
  }

  const lines: string[] = [];

  for (const diag of diagnostics) {
    let badge = "";
    if (diag.severity === "error") {
      badge = pc.bgRed(pc.white(" ERROR ")) + " " + pc.red(diag.ruleId);
    } else if (diag.severity === "warning") {
      badge = pc.bgYellow(pc.black(" WARN  ")) + " " + pc.yellow(diag.ruleId);
    } else {
      badge = pc.bgBlue(pc.white(" INFO  ")) + " " + pc.blue(diag.ruleId);
    }

    const location = diag.file
      ? `${pc.bold(diag.file)}${diag.line ? `:${diag.line}` : ""}${diag.column ? `:${diag.column}` : ""}`
      : "";

    lines.push(`${badge} ${location}`);
    lines.push(`  ${pc.bold(diag.message)}`);

    if (diag.maskedValue) {
      lines.push(`  ${pc.dim("Value:")} ${pc.cyan(diag.maskedValue)}`);
    }

    if (diag.confidence) {
      lines.push(
        `  ${pc.dim("Confidence:")} ${diag.confidence === "HIGH" ? pc.red("HIGH") : pc.yellow(diag.confidence)}`
      );
    }

    if (diag.snippet) {
      lines.push(`  ${pc.dim("Code:")} ${pc.dim(diag.snippet)}`);
    }

    if (diag.remediation) {
      lines.push(`  ${pc.dim("Remediation:")} ${pc.gray(diag.remediation)}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

export function formatScanSummary(result: ScanResult): string {
  const { errors, warnings, infos } = result.summary;
  const parts: string[] = [];

  if (errors > 0) parts.push(pc.red(`${errors} error${errors > 1 ? "s" : ""}`));
  if (warnings > 0) parts.push(pc.yellow(`${warnings} warning${warnings > 1 ? "s" : ""}`));
  if (infos > 0) parts.push(pc.blue(`${infos} info`));

  const statusText = result.valid ? pc.green("PASSED") : pc.red("FAILED");

  return [
    pc.bold(`Scan Complete: ${statusText}`),
    `Files scanned: ${result.filesScanned} | Variables analyzed: ${result.variablesAnalyzed}`,
    parts.length > 0 ? `Findings: ${parts.join(", ")}` : pc.green("Zero findings.")
  ].join("\n");
}

export function formatValidationReport(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push(pc.bold(pc.red(`\nValidation Errors (${result.errors.length}):`)));
    for (const err of result.errors) {
      lines.push(`  ${pc.red("✖")} ${pc.bold(err.key)}: ${err.message}`);
      if (err.expected) lines.push(`    ${pc.dim("Expected:")} ${err.expected}`);
      if (err.received !== undefined) {
        const received = SENSITIVE_KEY_PATTERN.test(err.key)
          ? maskSecret(String(err.received))
          : JSON.stringify(err.received);
        lines.push(`    ${pc.dim("Received:")} ${received}`);
      }
    }
  }

  if (result.warnings.length > 0) {
    lines.push(pc.bold(pc.yellow(`\nValidation Warnings (${result.warnings.length}):`)));
    for (const warn of result.warnings) {
      lines.push(`  ${pc.yellow("⚠")} ${pc.bold(warn.key)}: ${warn.message}`);
    }
  }

  if (result.valid) {
    lines.push(pc.green("\n✔ Environment configuration is valid against schema."));
  } else {
    lines.push(pc.red("\n✖ Environment configuration failed schema validation."));
  }

  return lines.join("\n");
}

export function formatCompareReport(result: CompareResult): string {
  const lines: string[] = [];
  lines.push(
    pc.bold(`\nComparing ${pc.cyan(result.sourceFile)} and ${pc.cyan(result.targetFile)}\n`)
  );

  if (result.missingInTarget.length > 0) {
    lines.push(
      pc.red(
        pc.bold(`Missing variables in ${result.targetFile} (${result.missingInTarget.length}):`)
      )
    );
    for (const k of result.missingInTarget) {
      lines.push(`  ${pc.red("-")} ${k}`);
    }
    lines.push("");
  }

  if (result.extraInTarget.length > 0) {
    lines.push(
      pc.yellow(
        pc.bold(`Extra variables in ${result.targetFile} (${result.extraInTarget.length}):`)
      )
    );
    for (const k of result.extraInTarget) {
      lines.push(`  ${pc.yellow("+")} ${k}`);
    }
    lines.push("");
  }

  if (result.emptyInTarget.length > 0) {
    lines.push(pc.dim(pc.bold(`Variables with empty values in ${result.targetFile}:`)));
    for (const k of result.emptyInTarget) {
      lines.push(`  ${pc.dim("•")} ${k}`);
    }
    lines.push("");
  }

  if (result.typeMismatches.length > 0) {
    lines.push(pc.yellow(pc.bold(`Potential Type Mismatches:`)));
    for (const tm of result.typeMismatches) {
      lines.push(`  ${pc.yellow("⚠")} ${tm.message}`);
    }
    lines.push("");
  }

  const errors = result.missingInTarget.length + result.typeMismatches.length;
  const warnings = result.extraInTarget.length + result.emptyInTarget.length;

  lines.push(
    `Result: ${errors === 0 ? pc.green("Identical key definitions") : pc.red(`${errors} missing/mismatched`)}, ` +
      `${warnings > 0 ? pc.yellow(`${warnings} extra/empty warnings`) : pc.green("0 warnings")}`
  );

  return lines.join("\n");
}

export function formatGitSafetyReport(result: GitSafetyResult): string {
  const lines: string[] = [];
  lines.push(pc.bold("\nGit Safety Audit Report\n"));

  if (!result.isGitRepo) {
    lines.push(pc.yellow("⚠ Working directory is not a Git repository."));
    return lines.join("\n");
  }

  if (result.trackedSensitiveFiles.length > 0) {
    lines.push(
      pc.bgRed(pc.white(" CRITICAL ")) + pc.red(" Sensitive environment file(s) tracked by Git:")
    );
    for (const file of result.trackedSensitiveFiles) {
      lines.push(
        `  ${pc.red("✖")} ${file} ${pc.gray("(Commits containing this file expose your credentials in Git history!)")}`
      );
    }
    lines.push(pc.dim("  Remediation: Run `git rm --cached <file>` and add it to `.gitignore`.\n"));
  }

  if (result.unignoredFiles.length > 0) {
    lines.push(
      pc.bgYellow(pc.black(" WARN ")) + pc.yellow(" Environment file(s) not ignored by Git:")
    );
    for (const file of result.unignoredFiles) {
      lines.push(`  ${pc.yellow("⚠")} ${file}`);
    }
    lines.push(
      pc.dim(
        "  Remediation: Add `.env` and `.env.*` to `.gitignore` to prevent accidental staging.\n"
      )
    );
  }

  if (result.stagedSensitiveFiles.length > 0) {
    lines.push(
      pc.bgRed(pc.white(" CRITICAL ")) + pc.red(" Potentially sensitive changes staged for commit:")
    );
    for (const staged of result.stagedSensitiveFiles) {
      lines.push(`  ${pc.red("✖")} ${staged.file}: ${staged.reason}`);
    }
    lines.push(
      pc.dim("  Remediation: Unstage with `git restore --staged <file>` before committing.\n")
    );
  }

  if (result.riskyIgnorePatterns.length > 0) {
    lines.push(pc.yellow("Risky .gitignore configurations:"));
    for (const pattern of result.riskyIgnorePatterns) {
      lines.push(`  ${pc.yellow("⚠")} ${pattern}`);
    }
    lines.push("");
  }

  if (result.valid) {
    lines.push(
      pc.green(
        "✔ All Git safety checks passed. No sensitive environment files tracked or unignored."
      )
    );
  } else {
    lines.push(pc.red("✖ Git safety issues detected. Please review recommendations above."));
  }

  return lines.join("\n");
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push(pc.bold("\nEnvGuardian — Environment Health Report\n"));
  lines.push(`Environment Files Found: ${report.filesFound.length}`);
  lines.push(`Variables Analyzed: ${report.variablesAnalyzed}\n`);

  lines.push(pc.bold("Checks:"));
  for (const check of report.checks) {
    let badge = "";
    if (check.status === "PASS") badge = pc.green("PASS ");
    else if (check.status === "WARN") badge = pc.yellow("WARN ");
    else badge = pc.red("FAIL ");

    lines.push(`${badge} ${check.name}: ${check.message}`);
    if (check.details) {
      for (const detail of check.details) {
        lines.push(`     ${pc.dim(detail)}`);
      }
    }
  }

  lines.push("");
  lines.push(pc.bold("Summary:"));
  lines.push(
    `${pc.green(`${report.summary.passed} passed`)}, ` +
      `${pc.yellow(`${report.summary.warnings} warning${report.summary.warnings === 1 ? "" : "s"}`)}, ` +
      `${pc.red(`${report.summary.failed} failed`)}`
  );

  if (report.recommendations.length > 0) {
    lines.push("");
    lines.push(pc.bold("Security & Maintenance Recommendations:"));
    for (const rec of report.recommendations) {
      lines.push(`• ${rec}`);
    }
  }

  return lines.join("\n");
}
