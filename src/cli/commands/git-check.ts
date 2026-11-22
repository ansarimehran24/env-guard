import fs from "node:fs";
import { checkGitSafety } from "../../security/git-checker.js";
import { formatGitSafetyReport } from "../../reporters/console.js";
import { formatJsonReport } from "../../reporters/json.js";

export interface GitCheckCommandOptions {
  format?: "text" | "json";
  output?: string;
  strict?: boolean;
  quiet?: boolean;
  staged?: boolean;
}

export async function runGitCheckCommand(options: GitCheckCommandOptions = {}): Promise<number> {
  const result = await checkGitSafety({ checkStaged: options.staged });

  const format = options.format || "text";
  let output = "";

  if (format === "json") {
    output = formatJsonReport(result);
  } else {
    output = formatGitSafetyReport(result);
  }

  if (options.output) {
    fs.writeFileSync(options.output, output, "utf8");
  } else if (!options.quiet || !result.valid) {
    console.log(output);
  }

  return result.valid ? 0 : 1;
}
