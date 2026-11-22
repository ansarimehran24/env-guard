import type { EnvSchema } from "./schema.js";
import type { ConfidenceLevel, DiagnosticSeverity } from "./diagnostic.js";

export interface SecretRule {
  id: string;
  name: string;
  pattern: RegExp | string;
  severity?: DiagnosticSeverity;
  confidence?: ConfidenceLevel;
  remediation?: string;
  entropyThreshold?: number;
}

export interface ScanOptions {
  secrets?: boolean;
  gitSafety?: boolean;
  frameworkSafety?: boolean;
  minEntropy?: number;
  customRules?: SecretRule[];
  excludePlaceholders?: boolean;
}

export interface EnvGuardianConfig {
  files?: string[];
  schema?: EnvSchema;
  scan?: ScanOptions;
  ignore?: string[];
  strict?: boolean;
  format?: "text" | "json" | "sarif";
  output?: string;
}

export type UserConfig = EnvGuardianConfig;
