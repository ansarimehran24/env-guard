import fs from "node:fs";
import { compareEnv } from "../../core/comparator.js";
import { formatCompareReport } from "../../reporters/console.js";
import { formatJsonReport } from "../../reporters/json.js";

export interface CompareCommandOptions {
  format?: "text" | "json";
  output?: string;
  strict?: boolean;
  quiet?: boolean;
}

export function runCompareCommand(
  sourceFile: string,
  targetFile: string,
  options: CompareCommandOptions = {}
): number {
  if (!sourceFile || !targetFile) {
    console.error("Usage: envguardian compare <sourceFile> <targetFile>");
    return 2;
  }

  if (!fs.existsSync(sourceFile)) {
    console.error(`Source environment file "${sourceFile}" does not exist.`);
    return 2;
  }

  if (!fs.existsSync(targetFile)) {
    console.error(`Target environment file "${targetFile}" does not exist.`);
    return 2;
  }

  const result = compareEnv(sourceFile, targetFile);

  const isValid = options.strict
    ? result.missingInTarget.length === 0 &&
      result.extraInTarget.length === 0 &&
      result.typeMismatches.length === 0
    : result.valid;

  const format = options.format || "text";
  let output = "";

  if (format === "json") {
    output = formatJsonReport(result);
  } else {
    output = formatCompareReport(result);
  }

  if (options.output) {
    fs.writeFileSync(options.output, output, "utf8");
  } else if (!options.quiet || !isValid) {
    console.log(output);
  }

  return isValid ? 0 : 1;
}
