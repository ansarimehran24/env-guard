export type DiagnosticSeverity = "error" | "warning" | "info";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface Diagnostic {
  ruleId: string;
  message: string;
  severity: DiagnosticSeverity;
  file?: string;
  line?: number;
  column?: number;
  endColumn?: number;
  snippet?: string;
  remediation?: string;
  variableName?: string;
  maskedValue?: string;
  confidence?: ConfidenceLevel;
}

export interface ScanResult {
  valid: boolean;
  filesScanned: number;
  variablesAnalyzed: number;
  diagnostics: Diagnostic[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}
