import { generateEnvExample } from "../../core/generator.js";
import pc from "picocolors";

export interface GenerateExampleCommandOptions {
  file?: string;
  output?: string;
  force?: boolean;
}

export function runGenerateExampleCommand(options: GenerateExampleCommandOptions = {}): number {
  const sourceFile = options.file || ".env";
  const outputFile = options.output || ".env.example";

  try {
    const result = generateEnvExample({
      sourceFile,
      outputFile,
      overwrite: options.force ?? false
    });

    console.log(
      pc.green(
        `✔ Successfully generated ${pc.bold(outputFile)} (${result.variablesProcessed} variables processed with safe placeholders).`
      )
    );
    return 0;
  } catch (err: any) {
    console.error(pc.red(`Error generating example file: ${err.message}`));
    return 2;
  }
}
