export * from "./diagnostic.js";
export * from "./schema.js";
export * from "./config.js";

export interface EnvToken {
  type: "key" | "value" | "assignment" | "comment" | "whitespace" | "newline";
  value: string;
  line: number;
  column: number;
}

export interface ParsedEnvEntry {
  key: string;
  value: string;
  raw: string;
  line: number;
  keyColumn: number;
  valueColumn: number;
  hasQuotes: boolean;
  quoteChar?: string;
  comment?: string;
}

export interface ParsedEnvFile {
  filePath: string;
  entries: ParsedEnvEntry[];
  entriesByKey: Map<string, ParsedEnvEntry[]>;
  rawLines: string[];
}

export interface CompareResult {
  sourceFile: string;
  targetFile: string;
  missingInTarget: string[];
  extraInTarget: string[];
  emptyInTarget: string[];
  typeMismatches: Array<{
    key: string;
    sourceType?: string;
    targetType?: string;
    message: string;
  }>;
  duplicateKeys: {
    source: string[];
    target: string[];
  };
  identicalCount: number;
  totalKeysSource: number;
  totalKeysTarget: number;
  valid: boolean;
}

export interface GitSafetyResult {
  isGitRepo: boolean;
  unignoredFiles: string[];
  trackedSensitiveFiles: string[];
  riskyIgnorePatterns: string[];
  stagedSensitiveFiles: Array<{
    file: string;
    reason: string;
  }>;
  valid: boolean;
  warnings: string[];
}

export interface DoctorReport {
  filesFound: string[];
  variablesAnalyzed: number;
  checks: Array<{
    name: string;
    status: "PASS" | "WARN" | "FAIL";
    message: string;
    details?: string[];
  }>;
  summary: {
    passed: number;
    warnings: number;
    failed: number;
  };
  valid: boolean;
  recommendations: string[];
}
