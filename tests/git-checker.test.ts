import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { checkGitSafety } from "../src/security/git-checker.js";

describe("checkGitSafety", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "envguardian-git-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("should handle non-git directory gracefully", async () => {
    const res = await checkGitSafety({ cwd: tempDir });
    expect(res.isGitRepo).toBe(false);
    expect(res.valid).toBe(true);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it("should detect sensitive .env files tracked in Git history", async () => {
    execFileSync("git", ["init"], { cwd: tempDir });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: tempDir });
    execFileSync("git", ["config", "user.name", "Tester"], { cwd: tempDir });

    // Create and track .env
    fs.writeFileSync(path.join(tempDir, ".env"), "PORT=3000\nSECRET=supersecret\n", "utf8");
    execFileSync("git", ["add", ".env"], { cwd: tempDir });
    execFileSync("git", ["commit", "-m", "add env"], { cwd: tempDir });

    const res = await checkGitSafety({ cwd: tempDir });
    expect(res.isGitRepo).toBe(true);
    expect(res.trackedSensitiveFiles).toContain(".env");
    expect(res.valid).toBe(false);
  });

  it("should detect unignored .env files in working directory", async () => {
    execFileSync("git", ["init"], { cwd: tempDir });
    fs.writeFileSync(path.join(tempDir, ".env"), "PORT=3000\n", "utf8");

    const res = await checkGitSafety({ cwd: tempDir });
    expect(res.unignoredFiles).toContain(".env");
    expect(res.valid).toBe(false);
  });

  it("should pass when .env is properly ignored in .gitignore", async () => {
    execFileSync("git", ["init"], { cwd: tempDir });
    fs.writeFileSync(path.join(tempDir, ".gitignore"), ".env\n.env.*\n!.env.example\n", "utf8");
    fs.writeFileSync(path.join(tempDir, ".env"), "PORT=3000\n", "utf8");

    const res = await checkGitSafety({ cwd: tempDir });
    expect(res.unignoredFiles).toHaveLength(0);
    expect(res.trackedSensitiveFiles).toHaveLength(0);
    expect(res.valid).toBe(true);
  });
});
