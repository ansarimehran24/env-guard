import fs from "node:fs";
import { scanEnv, discoverEnvFiles } from "../../core/scanner.js";
import { checkGitSafety } from "../../security/git-checker.js";
import { loadConfig } from "../../config/loader.js";
import { formatDiagnostics, formatScanSummary } from "../../reporters/console.js";
import { formatJsonReport } from "../../reporters/json.js";
import { formatSarifReport } from "../../reporters/sarif.js";
import type { ScanResult } from "../../types/diagnostic.js";

export interface ScanCommandOptions {
  file?: string;
  config?: string;
  format?: "text" | "json" | "sarif";
  output?: string;
  strict?: boolean;
  quiet?: boolean;
  staged?: boolean;
}

export async function runScanCommand(options: ScanCommandOptions): Promise<number> {
  const { config } = await loadConfig(options.config);

  const format = options.format || config.format || "text";
  const strict = options.strict ?? config.strict ?? false;

  let targetFiles: string[] = [];
  if (options.file) {
    targetFiles = [options.file];
  } else if (config.files && config.files.length > 0) {
    targetFiles = config.files;
  } else {
    targetFiles = discoverEnvFiles();
  }

  const scanResult: ScanResult = scanEnv(targetFiles, {
    secrets: config.scan?.secrets ?? true,
    frameworkSafety: config.scan?.frameworkSafety ?? true,
    minEntropy: config.scan?.minEntropy,
    customRules: config.scan?.customRules,
    strict
  });

  // If --staged is passed, also scan staged files for secrets
  if (options.staged) {
    const gitSafety = await checkGitSafety({ checkStaged: true });
    for (const staged of gitSafety.stagedSensitiveFiles) {
      scanResult.diagnostics.push({
        ruleId: "git/staged-secret",
        message: staged.reason,
        severity: "error",
        file: staged.file,
        remediation: "Unstage with `git restore --staged <file>` before committing."
      });
      scanResult.summary.errors++;
    }
    if (gitSafety.stagedSensitiveFiles.length > 0) {
      scanResult.valid = false;
    }
  }

  let formattedOutput = "";
  if (format === "json") {
    formattedOutput = formatJsonReport(scanResult);
  } else if (format === "sarif") {
    formattedOutput = formatSarifReport(scanResult.diagnostics);
  } else {
    formattedOutput = `${formatDiagnostics(scanResult.diagnostics)}\n\n${formatScanSummary(scanResult)}`;
  }

  const outputPath = options.output || config.output;
  if (outputPath) {
    fs.writeFileSync(outputPath, formattedOutput, "utf8");
  } else if (!options.quiet || !scanResult.valid) {
    console.log(formattedOutput);
  }

  if (strict) {
    return scanResult.summary.errors === 0 && scanResult.summary.warnings === 0 ? 0 : 1;
  }
  return scanResult.valid ? 0 : 1;
}
