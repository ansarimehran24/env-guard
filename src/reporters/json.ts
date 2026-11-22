import { maskSecret } from "../security/redaction.js";
import type { ValidationResult } from "../types/schema.js";

export function formatJsonReport(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

const SENSITIVE_KEY_PATTERN =
  /(?:SECRET|PASSWORD|PASSWD|TOKEN|API[_-]?KEY|PRIVATE[_-]?KEY|CREDENTIAL|AUTH|COOKIE|SESSION)/i;

/**
 * Formats CLI validation results without serializing the validated environment.
 * ValidationResult.data can contain every value from process.env, so including it
 * in a report would risk leaking credentials into terminals and CI artifacts.
 */
export function formatValidationJsonReport(result: ValidationResult): string {
  return JSON.stringify(
    {
      valid: result.valid,
      errors: result.errors.map((error) => ({
        ...error,
        received:
          error.received !== undefined && SENSITIVE_KEY_PATTERN.test(error.key)
            ? maskSecret(String(error.received))
            : error.received
      })),
      warnings: result.warnings
    },
    null,
    2
  );
}
