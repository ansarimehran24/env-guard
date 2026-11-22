import fs from "node:fs";
import path from "node:path";
import { scanEnv, discoverEnvFiles } from "./scanner.js";
import { checkGitSafety } from "../security/git-checker.js";
import { compareEnv } from "./comparator.js";
import type { DoctorReport } from "../types/index.js";
import type { EnvGuardianConfig } from "../types/config.js";

export interface RunDoctorOptions {
  cwd?: string;
  config?: EnvGuardianConfig;
}

/**
 * Runs a comprehensive doctor audit of the project's environment variables,
 * checking syntax, duplicates, git safety, secret leakage, and .env.example parity.
 */
export async function runDoctor(options: RunDoctorOptions = {}): Promise<DoctorReport> {
  const cwd = options.cwd || process.cwd();
  const checks: DoctorReport["checks"] = [];
  const recommendations: string[] = [];

  // 1. Locate environment files
  const discoveredFiles = discoverEnvFiles(cwd);
  const examplePath = path.join(cwd, ".env.example");
  const hasExample = fs.existsSync(examplePath);

  if (discoveredFiles.length === 0 && !hasExample) {
    checks.push({
      name: "Environment Files",
      status: "WARN",
      message: "No environment files (.env, .env.*) found in the current directory."
    });
    recommendations.push(
      "Create a .env file or run 'npx envguardian init' to scaffold an environment setup."
    );
  } else {
    checks.push({
      name: "Environment Files",
      status: "PASS",
      message: `Found ${discoveredFiles.length} environment file(s): ${discoveredFiles.join(", ") || "(none)"}`
    });
  }

  // 2. Scan files for syntax, duplicates, and secrets
  const targetPaths = discoveredFiles.map((f) => path.join(cwd, f));
  const scanResult = scanEnv(targetPaths, {
    secrets: options.config?.scan?.secrets ?? true,
    frameworkSafety: options.config?.scan?.frameworkSafety ?? true
  });

  // Check syntax
  const syntaxErrors = scanResult.diagnostics.filter((d) => d.ruleId.startsWith("syntax/"));
  const duplicates = syntaxErrors.filter((d) => d.ruleId === "syntax/duplicate-key");
  const malformed = syntaxErrors.filter(
    (d) => d.ruleId !== "syntax/duplicate-key" && d.severity === "error"
  );

  if (malformed.length === 0) {
    checks.push({
      name: "File Formatting & Syntax",
      status: "PASS",
      message: "All environment files are well-formed."
    });
  } else {
    checks.push({
      name: "File Formatting & Syntax",
      status: "FAIL",
      message: `Found ${malformed.length} syntax error(s) in environment files.`,
      details: malformed.map((m) => `${m.file}:${m.line} ${m.message}`)
    });
    recommendations.push("Fix malformed variable assignments and quote mismatches.");
  }

  // Check duplicates
  if (duplicates.length === 0) {
    checks.push({
      name: "Duplicate Variables",
      status: "PASS",
      message: "No duplicate variable declarations found."
    });
  } else {
    checks.push({
      name: "Duplicate Variables",
      status: "WARN",
      message: `Found ${duplicates.length} duplicate variable declaration(s).`,
      details: duplicates.map((d) => `${d.file}:${d.line} ${d.message}`)
    });
    recommendations.push("Consolidate duplicate keys to avoid unexpected overriding.");
  }

  // Check secrets
  const secretErrors = scanResult.diagnostics.filter((d) => d.ruleId.startsWith("secret/"));
  if (secretErrors.length === 0) {
    checks.push({
      name: "Secret Exposure",
      status: "PASS",
      message: "No high-risk secrets detected in scanned files."
    });
  } else {
    checks.push({
      name: "Secret Exposure",
      status: "FAIL",
      message: `Detected ${secretErrors.length} potential secret(s) in environment files.`,
      details: secretErrors.map((s) => `${s.file}:${s.line} ${s.message} (${s.maskedValue})`)
    });
    recommendations.push(
      "Review detected secrets. Rotate any credentials that may have been committed or exposed."
    );
  }

  // Check framework client-side leaks
  const frameworkLeaks = scanResult.diagnostics.filter((d) => d.ruleId.startsWith("framework/"));
  if (frameworkLeaks.length > 0) {
    checks.push({
      name: "Framework Client Exposure",
      status: "FAIL",
      message: `Detected ${frameworkLeaks.length} sensitive variable(s) prefixed for public client bundles.`,
      details: frameworkLeaks.map((f) => `${f.file}:${f.line} ${f.message}`)
    });
    recommendations.push(
      "Remove public framework prefixes (NEXT_PUBLIC_, VITE_, etc.) from variables holding sensitive credentials."
    );
  }

  // 3. Check Git safety
  const gitSafety = await checkGitSafety({ cwd, files: discoveredFiles });
  if (!gitSafety.isGitRepo) {
    checks.push({
      name: "Git Repository Safety",
      status: "WARN",
      message: "Directory is not a Git repository; git ignore checks skipped."
    });
  } else {
    if (gitSafety.trackedSensitiveFiles.length > 0) {
      checks.push({
        name: "Git Tracked Sensitive Files",
        status: "FAIL",
        message: `${gitSafety.trackedSensitiveFiles.length} sensitive environment file(s) are actively tracked in Git!`,
        details: gitSafety.trackedSensitiveFiles.map((f) => `git rm --cached ${f}`)
      });
      recommendations.push(
        "Run 'git rm --cached <file>' to untrack environment files from Git repository history."
      );
    } else {
      checks.push({
        name: "Git Tracked Sensitive Files",
        status: "PASS",
        message: "No sensitive environment files are tracked by Git."
      });
    }

    if (gitSafety.unignoredFiles.length > 0) {
      checks.push({
        name: "Git Ignored Status",
        status: "FAIL",
        message: `${gitSafety.unignoredFiles.length} environment file(s) are not ignored by .gitignore: ${gitSafety.unignoredFiles.join(", ")}`
      });
      recommendations.push(
        "Add '.env' and '.env.*' (except .env.example) to your .gitignore file."
      );
    } else {
      checks.push({
        name: "Git Ignored Status",
        status: "PASS",
        message: "Environment files are properly ignored by .gitignore."
      });
    }
  }

  // 4. Parity with .env.example
  if (!hasExample) {
    checks.push({
      name: ".env.example Parity",
      status: "WARN",
      message:
        "No .env.example file found. New contributors may not know which variables to configure."
    });
    recommendations.push("Run 'npx envguardian generate-example' to generate a safe .env.example.");
  } else {
    // Compare primary .env with .env.example if .env exists
    const primaryEnvPath = path.join(cwd, ".env");
    if (fs.existsSync(primaryEnvPath)) {
      const comp = compareEnv(examplePath, primaryEnvPath);
      if (comp.missingInTarget.length > 0) {
        checks.push({
          name: ".env.example Parity",
          status: "WARN",
          message: `.env is missing ${comp.missingInTarget.length} variable(s) documented in .env.example: ${comp.missingInTarget.join(", ")}`
        });
      } else {
        checks.push({
          name: ".env.example Parity",
          status: "PASS",
          message: ".env defines all variables required by .env.example."
        });
      }
    } else {
      checks.push({
        name: ".env.example Parity",
        status: "PASS",
        message: ".env.example is present."
      });
    }
  }

  // Summary counts
  const passed = checks.filter((c) => c.status === "PASS").length;
  const warnings = checks.filter((c) => c.status === "WARN").length;
  const failed = checks.filter((c) => c.status === "FAIL").length;

  return {
    filesFound: discoveredFiles,
    variablesAnalyzed: scanResult.variablesAnalyzed,
    checks,
    summary: {
      passed,
      warnings,
      failed
    },
    valid: failed === 0,
    recommendations
  };
}
