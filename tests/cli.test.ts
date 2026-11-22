import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { runScanCommand } from "../src/cli/commands/scan.js";
import { runValidateCommand } from "../src/cli/commands/validate.js";
import { runCompareCommand } from "../src/cli/commands/compare.js";
import { runDoctorCommand } from "../src/cli/commands/doctor.js";
import { runGitCheckCommand } from "../src/cli/commands/git-check.js";
import { runGenerateExampleCommand } from "../src/cli/commands/generate-example.js";
import { runInitCommand } from "../src/cli/commands/init.js";

describe("CLI Commands and Exit Codes", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "envguardian-cli-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("scan: should return 0 for clean env file and 1 for file containing secrets", async () => {
    const cleanFile = path.join(tempDir, ".env.clean");
    fs.writeFileSync(cleanFile, "PORT=3000\nNODE_ENV=development\n", "utf8");

    const codeClean = await runScanCommand({ file: cleanFile, quiet: true });
    expect(codeClean).toBe(0);

    const secretFile = path.join(tempDir, ".env.secret");
    fs.writeFileSync(secretFile, "AWS_KEY=AKIAIOSFODNN7EXAMPLE\n", "utf8");

    const codeSecret = await runScanCommand({ file: secretFile, quiet: true });
    expect(codeSecret).toBe(1);

    // Test output to file and JSON format
    const jsonOutput = path.join(tempDir, "scan-output.json");
    const codeJson = await runScanCommand({ file: cleanFile, format: "json", output: jsonOutput });
    expect(codeJson).toBe(0);
    expect(fs.existsSync(jsonOutput)).toBe(true);
  });

  it("validate: should return 0 when valid against config schema and 1 on error", async () => {
    const configPath = path.join(tempDir, "envguardian.config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        schema: {
          PORT: { type: "port", required: true },
          NODE_ENV: { type: "enum", values: ["development", "production"] }
        }
      }),
      "utf8"
    );

    const validEnv = path.join(tempDir, ".env.valid");
    fs.writeFileSync(validEnv, "PORT=3000\nNODE_ENV=production\n", "utf8");

    const codeValid = await runValidateCommand({ file: validEnv, config: configPath, quiet: true });
    expect(codeValid).toBe(0);

    const invalidEnv = path.join(tempDir, ".env.invalid");
    fs.writeFileSync(invalidEnv, "PORT=999999\nNODE_ENV=invalid_mode\n", "utf8");

    const codeInvalid = await runValidateCommand({
      file: invalidEnv,
      config: configPath,
      quiet: true
    });
    expect(codeInvalid).toBe(1);

    // Return 2 if no schema in config
    const emptyConfig = path.join(tempDir, "empty.config.json");
    fs.writeFileSync(emptyConfig, JSON.stringify({}), "utf8");
    const codeNoSchema = await runValidateCommand({ config: emptyConfig, quiet: true });
    expect(codeNoSchema).toBe(2);
  });

  it("compare: should return 0 when matching, 1 when missing keys, and 2 when files missing", () => {
    const src = path.join(tempDir, ".env.example");
    const tgt = path.join(tempDir, ".env");

    fs.writeFileSync(src, "PORT=3000\nNODE_ENV=development\n", "utf8");
    fs.writeFileSync(tgt, "PORT=3000\nNODE_ENV=development\n", "utf8");

    const codeMatch = runCompareCommand(src, tgt, { quiet: true });
    expect(codeMatch).toBe(0);

    fs.writeFileSync(tgt, "PORT=3000\n", "utf8"); // missing NODE_ENV
    const codeDiff = runCompareCommand(src, tgt, { quiet: true });
    expect(codeDiff).toBe(1);

    const codeMissing = runCompareCommand("nonexistent1", "nonexistent2", { quiet: true });
    expect(codeMissing).toBe(2);
  });

  it("doctor: should execute audit and return status code", async () => {
    execFileSync("git", ["init"], { cwd: tempDir });
    fs.writeFileSync(path.join(tempDir, ".gitignore"), ".env\n!.env.example\n", "utf8");
    fs.writeFileSync(path.join(tempDir, ".env"), "PORT=3000\n", "utf8");
    fs.writeFileSync(path.join(tempDir, ".env.example"), "PORT=3000\n", "utf8");

    const code = await runDoctorCommand({ quiet: true });
    expect(typeof code).toBe("number");
  });

  it("git-check: should execute git safety checks and return status code", async () => {
    execFileSync("git", ["init"], { cwd: tempDir });
    const code = await runGitCheckCommand({ quiet: true });
    expect(typeof code).toBe("number");
  });

  it("generate-example: should generate file successfully and return 0", () => {
    const src = path.join(tempDir, ".env");
    const out = path.join(tempDir, ".env.example");

    fs.writeFileSync(src, "PORT=8080\nAPI_KEY=super-secret-key-12345\n", "utf8");

    const code = runGenerateExampleCommand({ file: src, output: out });
    expect(code).toBe(0);
    expect(fs.existsSync(out)).toBe(true);

    const content = fs.readFileSync(out, "utf8");
    expect(content).toContain("PORT=8080");
    expect(content).toContain("API_KEY=your-api-key-here");
    expect(content).not.toContain("super-secret-key-12345");
  });

  it("init: should initialize project config and return 0", async () => {
    fs.writeFileSync(path.join(tempDir, ".env"), "PORT=5000\n", "utf8");
    const code = await runInitCommand({ cwd: tempDir, yes: true });
    expect(code).toBe(0);
    expect(fs.existsSync(path.join(tempDir, "envguardian.config.json"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, ".env.example"))).toBe(true);
  });
});
