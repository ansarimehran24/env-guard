import fs from "node:fs";
import { validateEnv } from "../../core/validator.js";
import { parseEnvContent } from "../../core/parser.js";
import { loadConfig } from "../../config/loader.js";
import { formatValidationReport } from "../../reporters/console.js";
import { formatValidationJsonReport } from "../../reporters/json.js";

export interface ValidateCommandOptions {
  file?: string;
  config?: string;
  format?: "text" | "json";
  output?: string;
  strict?: boolean;
  quiet?: boolean;
}

export async function runValidateCommand(options: ValidateCommandOptions): Promise<number> {
  const { config } = await loadConfig(options.config);

  if (!config.schema || Object.keys(config.schema).length === 0) {
    console.error(
      "No validation schema found. Define a schema in envguardian.config.ts / .json or pass a config file."
    );
    return 2;
  }

  const envFile = options.file || (config.files && config.files[0]) || ".env";
  let envMap: Record<string, string | undefined> = {};

  if (fs.existsSync(envFile)) {
    const parsed = parseEnvContent(fs.readFileSync(envFile, "utf8"), envFile);
    for (const entry of parsed.file.entries) {
      envMap[entry.key] = entry.value;
    }
  } else {
    // If no file exists, validate against process.env
    envMap = { ...process.env };
  }

  const result = validateEnv(envMap, config.schema);
  const strict = options.strict ?? config.strict ?? false;

  const isValid = strict
    ? result.errors.length === 0 && result.warnings.length === 0
    : result.valid;

  const format = options.format || config.format || "text";
  let output = "";

  if (format === "json") {
    output = formatValidationJsonReport({ ...result, valid: isValid });
  } else {
    output = formatValidationReport(result);
  }

  const outputPath = options.output || config.output;
  if (outputPath) {
    fs.writeFileSync(outputPath, output, "utf8");
  } else if (!options.quiet || !isValid) {
    console.log(output);
  }

  return isValid ? 0 : 1;
}
