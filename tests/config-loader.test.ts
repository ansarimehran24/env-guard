import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadConfig, defineConfig } from "../src/config/loader.js";

describe("Configuration Loader", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "envguardian-config-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("should define configuration using defineConfig helper", () => {
    const cfg = defineConfig({
      files: [".env"],
      schema: {
        PORT: { type: "port", default: 3000 }
      }
    });
    expect(cfg.files).toEqual([".env"]);
    expect(cfg.schema?.PORT.type).toBe("port");
  });

  it("should load JSON configuration file", async () => {
    const configData = {
      files: [".env.production"],
      strict: true,
      scan: { secrets: true }
    };
    fs.writeFileSync(
      path.join(tempDir, "envguardian.config.json"),
      JSON.stringify(configData),
      "utf8"
    );

    const { config, configPath } = await loadConfig(undefined, tempDir);
    expect(configPath).toBeDefined();
    expect(config.files).toEqual([".env.production"]);
    expect(config.strict).toBe(true);
  });

  it("should return empty config when no file exists", async () => {
    const { config } = await loadConfig(undefined, tempDir);
    expect(config).toEqual({});
  });

  it("should load TypeScript configuration without an external loader", async () => {
    fs.writeFileSync(
      path.join(tempDir, "envguardian.config.ts"),
      `import type { EnvGuardianConfig } from "${path.resolve("src/types/config.ts")}";
const config: EnvGuardianConfig = { files: [".env.test"], strict: true };
export default config;`,
      "utf8"
    );

    const { config, configPath } = await loadConfig(undefined, tempDir);
    expect(configPath).toMatch(/envguardian\.config\.ts$/);
    expect(config).toMatchObject({ files: [".env.test"], strict: true });
  });

  it("should report malformed JSON configuration", async () => {
    fs.writeFileSync(path.join(tempDir, "broken.json"), "{invalid", "utf8");
    await expect(loadConfig("broken.json", tempDir)).rejects.toThrow("Failed to parse JSON config");
  });

  it("should load native JavaScript configuration", async () => {
    fs.writeFileSync(
      path.join(tempDir, "envguardian.config.mjs"),
      "export default { files: ['.env.mjs'], strict: false };\n",
      "utf8"
    );
    const { config } = await loadConfig(undefined, tempDir);
    expect(config.files).toEqual([".env.mjs"]);
  });

  it("should throw error if custom config path does not exist", async () => {
    await expect(loadConfig("nonexistent.json", tempDir)).rejects.toThrow(
      "Configuration file not found"
    );
  });
});
