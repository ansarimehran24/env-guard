import type {
  EnvSchema,
  FieldValidationSchema,
  ValidationError,
  ValidationWarning,
  ValidationResult
} from "../types/schema.js";

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Validates an environment object (such as process.env or a parsed .env file dictionary)
 * against a typed EnvGuardian schema. Does NOT mutate process.env.
 */
export function validateEnv<T extends Record<string, any> = Record<string, any>>(
  env: Record<string, string | undefined>,
  schema: EnvSchema
): ValidationResult<T> {
  const data: Record<string, any> = {};
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const [key, rule] of Object.entries(schema)) {
    const rawVal = env[key];
    const isProvided = rawVal !== undefined && rawVal !== "";

    if (!isProvided) {
      if (rule.default !== undefined) {
        data[key] = rule.default;
        continue;
      }

      if (rule.required) {
        errors.push({
          key,
          message: `Required environment variable "${key}" is missing`,
          expected: `Type: ${rule.type}${rule.values ? ` (${rule.values.join(", ")})` : ""}`
        });
        continue;
      }

      // Optional and not provided
      data[key] = undefined;
      continue;
    }

    // Parse and validate based on type
    const parsed = validateField(key, rawVal, rule, errors, warnings);
    if (parsed !== undefined) {
      data[key] = parsed;
    }
  }

  // Also retain other environment variables not in schema
  for (const [key, val] of Object.entries(env)) {
    if (!(key in schema) && val !== undefined) {
      data[key] = val;
    }
  }

  return {
    valid: errors.length === 0,
    data: data as T,
    errors,
    warnings
  };
}

function validateField(
  key: string,
  val: string,
  rule: FieldValidationSchema,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): any {
  let parsedValue: any = val;

  switch (rule.type) {
    case "string":
      parsedValue = val;
      break;

    case "nonempty_string": {
      if (val.trim().length === 0) {
        errors.push({
          key,
          received: val,
          message: `Variable "${key}" must be a non-empty string`,
          expected: "Non-empty string"
        });
        return undefined;
      }
      parsedValue = val;
      break;
    }

    case "number": {
      const num = Number(val);
      if (isNaN(num)) {
        errors.push({
          key,
          received: val,
          message: `Variable "${key}" must be a valid number`,
          expected: "Number"
        });
        return undefined;
      }
      parsedValue = num;
      break;
    }

    case "integer": {
      const intNum = Number(val);
      if (isNaN(intNum) || !Number.isInteger(intNum)) {
        errors.push({
          key,
          received: val,
          message: `Variable "${key}" must be a valid integer`,
          expected: "Integer"
        });
        return undefined;
      }
      parsedValue = intNum;
      break;
    }

    case "port": {
      const portNum = Number(val);
      if (isNaN(portNum) || !Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        errors.push({
          key,
          received: val,
          message: `Variable "${key}" must be a valid port number (1-65535)`,
          expected: "Port (1 - 65535)"
        });
        return undefined;
      }
      parsedValue = portNum;
      break;
    }

    case "boolean": {
      const lower = val.toLowerCase().trim();
      if (lower === "true" || lower === "1" || lower === "yes") {
        parsedValue = true;
      } else if (lower === "false" || lower === "0" || lower === "no") {
        parsedValue = false;
      } else {
        errors.push({
          key,
          received: val,
          message: `Variable "${key}" must be a boolean (true/false, 1/0, yes/no)`,
          expected: "Boolean"
        });
        return undefined;
      }
      break;
    }

    case "url": {
      try {
        const u = new URL(val);
        if (!u.protocol || !u.host) {
          throw new Error("Invalid URL structure");
        }
        parsedValue = val;
      } catch {
        errors.push({
          key,
          received: val,
          message: `Variable "${key}" must be a valid URL`,
          expected: "Valid URL (e.g., https://example.com)"
        });
        return undefined;
      }
      break;
    }

    case "email": {
      if (!EMAIL_REGEX.test(val.trim())) {
        errors.push({
          key,
          received: val,
          message: `Variable "${key}" must be a valid email address`,
          expected: "Valid email (e.g., user@example.com)"
        });
        return undefined;
      }
      parsedValue = val.trim();
      break;
    }

    case "enum": {
      if (!rule.values || !Array.isArray(rule.values) || rule.values.length === 0) {
        warnings.push({
          key,
          message: `Schema rule for enum "${key}" does not define any allowed values`
        });
        parsedValue = val;
        break;
      }
      const match = rule.values.some((v) => String(v) === val);
      if (!match) {
        errors.push({
          key,
          received: val,
          message: `Variable "${key}" must be one of: [${rule.values.join(", ")}]`,
          expected: rule.values.join(" | ")
        });
        return undefined;
      }
      parsedValue = val;
      break;
    }

    case "json": {
      try {
        parsedValue = JSON.parse(val);
      } catch (err: any) {
        errors.push({
          key,
          received: val,
          message: `Variable "${key}" must be valid JSON: ${err.message}`,
          expected: "Valid JSON string"
        });
        return undefined;
      }
      break;
    }

    default:
      parsedValue = val;
      break;
  }

  // Length constraints
  if (typeof parsedValue === "string") {
    if (rule.minLength !== undefined && parsedValue.length < rule.minLength) {
      errors.push({
        key,
        received: parsedValue,
        message: `Variable "${key}" length must be at least ${rule.minLength} characters (got ${parsedValue.length})`
      });
    }
    if (rule.maxLength !== undefined && parsedValue.length > rule.maxLength) {
      errors.push({
        key,
        received: parsedValue,
        message: `Variable "${key}" length must be at most ${rule.maxLength} characters (got ${parsedValue.length})`
      });
    }
  }

  // Numeric range constraints
  if (typeof parsedValue === "number") {
    if (rule.min !== undefined && parsedValue < rule.min) {
      errors.push({
        key,
        received: parsedValue,
        message: `Variable "${key}" value must be >= ${rule.min} (got ${parsedValue})`
      });
    }
    if (rule.max !== undefined && parsedValue > rule.max) {
      errors.push({
        key,
        received: parsedValue,
        message: `Variable "${key}" value must be <= ${rule.max} (got ${parsedValue})`
      });
    }
  }

  // Regex constraint
  if (rule.regex) {
    const rx = typeof rule.regex === "string" ? new RegExp(rule.regex) : rule.regex;
    if (!rx.test(String(parsedValue))) {
      errors.push({
        key,
        received: parsedValue,
        message: `Variable "${key}" does not match required pattern ${rx}`
      });
    }
  }

  // Custom validation
  if (rule.custom) {
    try {
      const res = rule.custom(parsedValue);
      if (typeof res === "boolean") {
        if (!res) {
          errors.push({
            key,
            received: parsedValue,
            message: `Variable "${key}" failed custom validation`
          });
        }
      } else if (typeof res === "string") {
        errors.push({
          key,
          received: parsedValue,
          message: res
        });
      } else if (res && typeof res === "object") {
        if (!res.valid) {
          errors.push({
            key,
            received: parsedValue,
            message: res.error || `Variable "${key}" failed custom validation`
          });
        }
      }
    } catch (err: any) {
      errors.push({
        key,
        received: parsedValue,
        message: `Custom validator error for "${key}": ${err.message}`
      });
    }
  }

  return parsedValue;
}
