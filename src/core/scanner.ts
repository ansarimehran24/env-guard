import fs from "node:fs";
import { parseEnvContent } from "./parser.js";
import { detectSecrets } from "../security/secret-detector.js";
import {
  isPublicFrameworkVariable,
  isPublicVariableWithSensitiveName,
  getFrameworkName
} from "../utils/framework.js";
import type { Diagnostic, ScanResult } from "../types/diagnostic.js";
import type { ScanOptions } from "../types/config.js";
import type { SecretPatternRule } from "../security/secret-detector.js";

export interface ScanEnvFileOptions extends ScanOptions {
  files?: string[];
  strict?: boolean;
}

/**
 * Discovers default .env files in a directory if no files are explicitly supplied.
 */
export function discoverEnvFiles(cwd = process.cwd()): string[] {
  try {
    const files = fs.readdirSync(cwd);
    return files.filter((f) => {
      if (f === ".env.example" || f === ".env.template") return false;
      return f === ".env" || f.startsWith(".env.");
    });
  } catch {
    return [".env"];
  }
}

/**
 * Scans environment files or raw content for syntax errors, secrets,
 * framework security risks, and duplicate keys.
 */
export function scanEnv(
  targets?: string[] | { path: string; content: string }[],
  options: ScanEnvFileOptions = {}
): ScanResult {
  const diagnostics: Diagnostic[] = [];
  let filesScanned = 0;
  let variablesAnalyzed = 0;
  const customRules: SecretPatternRule[] = [];

  for (const rule of options.customRules ?? []) {
    try {
      customRules.push({
        id: rule.id,
        name: rule.name,
        regex: rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern),
        confidence: rule.confidence ?? (rule.severity === "error" ? "HIGH" : "MEDIUM"),
        severity: rule.severity,
        remediation: rule.remediation ?? "Remove or rotate the detected credential."
      });
    } catch (error) {
      diagnostics.push({
        ruleId: "config/invalid-secret-rule",
        message: `Custom secret rule "${rule.id}" has an invalid regular expression: ${error instanceof Error ? error.message : String(error)}`,
        severity: "error",
        remediation: "Fix the custom rule pattern in the EnvGuardian configuration."
      });
    }
  }

  // Normalize targets
  let fileTargets: Array<{ path: string; content?: string }> = [];

  if (!targets || targets.length === 0) {
    const discovered = discoverEnvFiles();
    fileTargets = discovered.map((p) => ({ path: p }));
  } else if (typeof targets[0] === "string") {
    fileTargets = (targets as string[]).map((p) => ({ path: p }));
  } else {
    fileTargets = targets as Array<{ path: string; content?: string }>;
  }

  for (const target of fileTargets) {
    let content = target.content;
    const filePath = target.path;

    if (content === undefined) {
      if (!fs.existsSync(filePath)) {
        diagnostics.push({
          ruleId: "io/file-not-found",
          message: `Environment file "${filePath}" does not exist`,
          severity: "error",
          file: filePath,
          remediation: "Ensure the path to the environment file is correct."
        });
        continue;
      }
      try {
        content = fs.readFileSync(filePath, "utf8");
      } catch (err: any) {
        diagnostics.push({
          ruleId: "io/read-error",
          message: `Could not read file "${filePath}": ${err.message}`,
          severity: "error",
          file: filePath,
          remediation: "Check file permissions."
        });
        continue;
      }
    }

    filesScanned++;

    // 1. Run parser to catch syntax errors, duplicates, bad quotes, whitespace
    const parseResult = parseEnvContent(content, filePath);
    diagnostics.push(...parseResult.diagnostics);

    // 2. Analyze each entry for secrets and framework risks
    const checkSecrets = options.secrets ?? true;
    const checkFramework = options.frameworkSafety ?? true;

    for (const entry of parseResult.file.entries) {
      variablesAnalyzed++;

      // Secret check
      if (checkSecrets) {
        const secretDiags = detectSecrets(
          entry.key,
          entry.value,
          { file: filePath, line: entry.line, column: entry.valueColumn },
          {
            customRules: customRules.length > 0 ? customRules : undefined,
            minEntropy: options.minEntropy,
            excludePlaceholders: options.excludePlaceholders
          }
        );
        diagnostics.push(...secretDiags);
      }

      // Framework public exposure check
      if (checkFramework && isPublicFrameworkVariable(entry.key)) {
        const fwName = getFrameworkName(entry.key) || "Frontend Framework";

        if (isPublicVariableWithSensitiveName(entry.key)) {
          diagnostics.push({
            ruleId: "framework/public-secret-leak",
            message: `Public framework variable "${entry.key}" appears to hold sensitive credentials (${fwName})`,
            severity: "error",
            confidence: "HIGH",
            file: filePath,
            line: entry.line,
            column: entry.keyColumn,
            variableName: entry.key,
            remediation: `${fwName} bundles variables with this prefix into client-side JavaScript. Never assign private keys, tokens, or secrets to public client variables.`
          });
        }
      }
    }
  }

  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;
  const infos = diagnostics.filter((d) => d.severity === "info").length;

  const valid = options.strict ? errors === 0 && warnings === 0 : errors === 0;

  return {
    valid,
    filesScanned,
    variablesAnalyzed,
    diagnostics,
    summary: {
      errors,
      warnings,
      infos
    }
  };
}
