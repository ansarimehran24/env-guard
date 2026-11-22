import fs from "node:fs";
import { runDoctor } from "../../core/doctor.js";
import { loadConfig } from "../../config/loader.js";
import { formatDoctorReport } from "../../reporters/console.js";
import { formatJsonReport } from "../../reporters/json.js";

export interface DoctorCommandOptions {
  config?: string;
  format?: "text" | "json";
  output?: string;
  strict?: boolean;
  quiet?: boolean;
}

export async function runDoctorCommand(options: DoctorCommandOptions = {}): Promise<number> {
  const { config } = await loadConfig(options.config);
  const report = await runDoctor({ config });

  const strict = options.strict ?? config.strict ?? false;
  const isValid = strict
    ? report.summary.failed === 0 && report.summary.warnings === 0
    : report.valid;

  const format = options.format || config.format || "text";
  let output = "";

  if (format === "json") {
    output = formatJsonReport(report);
  } else {
    output = formatDoctorReport(report);
  }

  const outputPath = options.output || config.output;
  if (outputPath) {
    fs.writeFileSync(outputPath, output, "utf8");
  } else if (!options.quiet || !isValid) {
    console.log(output);
  }

  return isValid ? 0 : 1;
}
