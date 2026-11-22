import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createJiti } from "jiti";
import type { EnvGuardianConfig } from "../types/config.js";

/**
 * Type helper for defining EnvGuardian configurations with autocomplete.
 */
export function defineConfig(config: EnvGuardianConfig): EnvGuardianConfig {
  return config;
}

export const CONFIG_FILE_CANDIDATES = [
  "envguardian.config.ts",
  "envguardian.config.js",
  "envguardian.config.mjs",
  "envguardian.config.json",
  ".envguardianrc.json"
];

/**
 * Loads and parses an EnvGuardian configuration file.
 * Precedence: CLI flags > Config File > Default values.
 */
export async function loadConfig(
  customConfigPath?: string,
  cwd = process.cwd()
): Promise<{ config: EnvGuardianConfig; configPath?: string }> {
  let resolvedPath: string | undefined;

  if (customConfigPath) {
    const fullPath = path.resolve(cwd, customConfigPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Configuration file not found: "${customConfigPath}"`);
    }
    resolvedPath = fullPath;
  } else {
    for (const candidate of CONFIG_FILE_CANDIDATES) {
      const full = path.resolve(cwd, candidate);
      if (fs.existsSync(full)) {
        resolvedPath = full;
        break;
      }
    }
  }

  if (!resolvedPath) {
    return { config: {} };
  }

  // Handle JSON configuration
  if (resolvedPath.endsWith(".json")) {
    try {
      const raw = fs.readFileSync(resolvedPath, "utf8");
      const parsed = JSON.parse(raw);
      return { config: parsed, configPath: resolvedPath };
    } catch (err: any) {
      throw new Error(`Failed to parse JSON config at "${resolvedPath}": ${err.message}`);
    }
  }

  // Handle TypeScript configuration with the package's bundled runtime loader.
  if (resolvedPath.endsWith(".ts")) {
    try {
      const jiti = createJiti(import.meta.url);
      const config = await jiti.import<EnvGuardianConfig>(resolvedPath, { default: true });
      return { config, configPath: resolvedPath };
    } catch (err: any) {
      throw new Error(`Failed to import TypeScript config at "${resolvedPath}": ${err.message}`);
    }
  }

  // Handle JavaScript and MJS configuration via native dynamic import.
  try {
    const fileUrl = pathToFileURL(resolvedPath).href;
    const module = await import(fileUrl);
    const config = module.default || module;
    return { config, configPath: resolvedPath };
  } catch (err: any) {
    throw new Error(`Failed to import configuration file at "${resolvedPath}": ${err.message}`);
  }
}
