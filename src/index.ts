/**
 * EnvGuardian — Production-ready developer environment variable security & validation toolkit.
 */

// Core functional APIs
export { validateEnv } from "./core/validator.js";
export { scanEnv, discoverEnvFiles } from "./core/scanner.js";
export { compareEnv } from "./core/comparator.js";
export { generateEnvExample, inferPlaceholder } from "./core/generator.js";
export { parseEnvContent } from "./core/parser.js";
export { runDoctor } from "./core/doctor.js";

// Security APIs
export { checkGitSafety } from "./security/git-checker.js";
export { detectSecrets, BUILTIN_SECRET_RULES } from "./security/secret-detector.js";
export { maskSecret, isPlaceholderOrExample } from "./security/redaction.js";

// Configuration APIs
export { defineConfig, loadConfig } from "./config/loader.js";

// Reporters
export {
  formatDiagnostics,
  formatScanSummary,
  formatValidationReport,
  formatCompareReport,
  formatGitSafetyReport,
  formatDoctorReport
} from "./reporters/console.js";
export { formatJsonReport, formatValidationJsonReport } from "./reporters/json.js";
export { formatSarifReport } from "./reporters/sarif.js";

// Utilities
export { calculateShannonEntropy, isHighEntropy } from "./utils/entropy.js";
export {
  isPublicFrameworkVariable,
  isPublicVariableWithSensitiveName,
  getFrameworkName,
  PUBLIC_PREFIXES,
  SENSITIVE_KEY_WORDS
} from "./utils/framework.js";

// Type definitions
export * from "./types/index.js";
