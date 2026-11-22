import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import type { GitSafetyResult } from "../types/index.js";
import { detectSecrets } from "./secret-detector.js";

const execFileAsync = promisify(execFile);

/**
 * Executes a git command safely with arguments array, preventing shell interpolation.
 */
async function runGit(
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
      encoding: "utf8"
    });
    return { stdout, stderr, code: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      code: err.code || (typeof err.status === "number" ? err.status : 1)
    };
  }
}

export interface GitCheckerOptions {
  cwd?: string;
  files?: string[];
  checkStaged?: boolean;
}

/**
 * Checks Git repository safety regarding environment variables and secrets.
 */
export async function checkGitSafety(options: GitCheckerOptions = {}): Promise<GitSafetyResult> {
  const cwd = options.cwd || process.cwd();
  const warnings: string[] = [];

  // 1. Verify if in a Git repository
  const gitCheck = await runGit(["rev-parse", "--is-inside-work-tree"], cwd);
  if (gitCheck.code !== 0 || gitCheck.stdout.trim() !== "true") {
    return {
      isGitRepo: false,
      unignoredFiles: [],
      trackedSensitiveFiles: [],
      riskyIgnorePatterns: [],
      stagedSensitiveFiles: [],
      valid: true,
      warnings: ["Not a Git repository. Git safety checks skipped."]
    };
  }

  // 2. Discover environment files in the working directory
  let targetFiles: string[] = options.files || [];
  if (targetFiles.length === 0) {
    try {
      const dirEntries = fs.readdirSync(cwd);
      targetFiles = dirEntries.filter((file) => {
        if (file === ".env.example" || file === ".env.template") return false;
        return file === ".env" || file.startsWith(".env.");
      });
    } catch {
      targetFiles = [];
    }
  }

  const unignoredFiles: string[] = [];
  const trackedSensitiveFiles: string[] = [];
  const stagedSensitiveFiles: Array<{ file: string; reason: string }> = [];
  const riskyIgnorePatterns: string[] = [];

  // 3. Check tracked files using `git ls-files`
  if (targetFiles.length > 0) {
    const lsFilesRes = await runGit(["ls-files", "--", ...targetFiles], cwd);
    if (lsFilesRes.code === 0 && lsFilesRes.stdout.trim().length > 0) {
      const trackedList = lsFilesRes.stdout
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      for (const tracked of trackedList) {
        if (!tracked.endsWith(".example") && !tracked.endsWith(".template")) {
          trackedSensitiveFiles.push(tracked);
        }
      }
    }
  }

  // 4. Check if environment files are ignored using `git check-ignore`
  for (const file of targetFiles) {
    if (file.endsWith(".example") || file.endsWith(".template")) continue;
    // Skip if already tracked
    if (trackedSensitiveFiles.includes(file)) continue;

    const ignoreCheck = await runGit(["check-ignore", "-q", file], cwd);
    // Exit code 0 means ignored; exit code 1 means NOT ignored
    if (ignoreCheck.code === 1) {
      unignoredFiles.push(file);
    }
  }

  // 5. Inspect .gitignore for risky or missing patterns
  const gitignorePath = path.join(cwd, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    try {
      const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
      const lines = gitignoreContent.split(/\r?\n/).map((l) => l.trim());

      const ignoresEnv = lines.some(
        (line) => line === ".env" || line === ".env*" || line === "*.env"
      );
      if (!ignoresEnv) {
        riskyIgnorePatterns.push(
          ".gitignore does not contain an entry to ignore '.env' or '.env*'"
        );
      }
    } catch {
      // ignore read error
    }
  } else {
    riskyIgnorePatterns.push("No .gitignore file found in repository root");
  }

  // 6. Check staged files if requested or if staged files exist
  const stagedRes = await runGit(["diff", "--name-only", "--cached"], cwd);
  if (stagedRes.code === 0 && stagedRes.stdout.trim().length > 0) {
    const stagedFiles = stagedRes.stdout
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stagedFile of stagedFiles) {
      // Check if file name itself is a sensitive env file
      if (
        (stagedFile === ".env" || stagedFile.startsWith(".env.")) &&
        !stagedFile.endsWith(".example") &&
        !stagedFile.endsWith(".template")
      ) {
        stagedSensitiveFiles.push({
          file: stagedFile,
          reason: "Environment file staged for Git commit"
        });
        continue;
      }

      // If checkStaged requested, inspect staged content for potential secrets
      if (options.checkStaged) {
        const showRes = await runGit(["show", `:${stagedFile}`], cwd);
        if (showRes.code === 0 && showRes.stdout) {
          const lines = showRes.stdout.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const eqIdx = line.indexOf("=");
            if (eqIdx !== -1) {
              const k = line.slice(0, eqIdx).trim();
              const v = line.slice(eqIdx + 1).trim();
              const secrets = detectSecrets(k, v, { file: stagedFile, line: i + 1 });
              if (secrets.length > 0) {
                stagedSensitiveFiles.push({
                  file: stagedFile,
                  reason: `Staged changes contain ${secrets[0].message} on line ${i + 1}`
                });
                break;
              }
            }
          }
        }
      }
    }
  }

  const valid =
    trackedSensitiveFiles.length === 0 &&
    unignoredFiles.length === 0 &&
    stagedSensitiveFiles.length === 0;

  return {
    isGitRepo: true,
    unignoredFiles,
    trackedSensitiveFiles,
    riskyIgnorePatterns,
    stagedSensitiveFiles,
    valid,
    warnings
  };
}
