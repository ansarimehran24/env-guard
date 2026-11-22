import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { runDoctor } from "../src/core/doctor.js";

describe("runDoctor", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "envguardian-doctor-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("should run complete doctor audit and produce structured checklist", async () => {
    // Setup git and safe files
    execFileSync("git", ["init"], { cwd: tempDir });
    fs.writeFileSync(path.join(tempDir, ".gitignore"), ".env\n!.env.example\n", "utf8");
    fs.writeFileSync(path.join(tempDir, ".env"), "PORT=3000\nNODE_ENV=development\n", "utf8");
    fs.writeFileSync(
      path.join(tempDir, ".env.example"),
      "PORT=3000\nNODE_ENV=development\n",
      "utf8"
    );

    const report = await runDoctor({ cwd: tempDir });
    expect(report.filesFound).toContain(".env");
    expect(report.checks.length).toBeGreaterThanOrEqual(5);

    const envFilesCheck = report.checks.find((c) => c.name === "Environment Files");
    expect(envFilesCheck?.status).toBe("PASS");

    const syntaxCheck = report.checks.find((c) => c.name === "File Formatting & Syntax");
    expect(syntaxCheck?.status).toBe("PASS");

    const secretCheck = report.checks.find((c) => c.name === "Secret Exposure");
    expect(secretCheck?.status).toBe("PASS");

    expect(report.summary.passed).toBeGreaterThan(0);
    expect(report.valid).toBe(true);
  });

  it("should fail health report when secrets or syntax errors are present", async () => {
    execFileSync("git", ["init"], { cwd: tempDir });
    fs.writeFileSync(
      path.join(tempDir, ".env"),
      "INVALID LINE WITHOUT EQUALS\nGITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz1234\n",
      "utf8"
    );

    const report = await runDoctor({ cwd: tempDir });
    expect(report.valid).toBe(false);
    expect(report.summary.failed).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});
