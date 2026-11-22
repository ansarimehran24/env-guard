export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "url"
  | "email"
  | "integer"
  | "enum"
  | "json"
  | "port"
  | "nonempty_string";

export type CustomValidatorResult = boolean | string | { valid: boolean; error?: string };

export interface FieldValidationSchema<T = unknown> {
  type: FieldType;
  required?: boolean;
  default?: T;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  regex?: RegExp | string;
  values?: readonly (string | number)[];
  custom?: (val: unknown) => CustomValidatorResult;
  description?: string;
}

export type EnvSchema = Record<string, FieldValidationSchema<any>>;

export interface ValidationError {
  key: string;
  message: string;
  received?: unknown;
  expected?: string;
}

export interface ValidationWarning {
  key: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult<T = Record<string, any>> {
  valid: boolean;
  data: T;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
