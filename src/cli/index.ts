import { Command } from "commander";
import { runScanCommand } from "./commands/scan.js";
import { runValidateCommand } from "./commands/validate.js";
import { runCompareCommand } from "./commands/compare.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runGitCheckCommand } from "./commands/git-check.js";
import { runGenerateExampleCommand } from "./commands/generate-example.js";
import { runInitCommand } from "./commands/init.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("envguardian")
    .description(
      "Production-ready developer security toolkit and validator for environment variables"
    )
    .version("1.0.0");

  program
    .command("scan")
    .description("Scan environment files for syntax errors, secrets, and public framework leaks")
    .option("-f, --file <path>", "Specific environment file to scan")
    .option("-c, --config <path>", "Path to configuration file")
    .option("--format <format>", "Output format (text, json, sarif)", "text")
    .option("-o, --output <path>", "Write report to file")
    .option("--strict", "Fail on warnings as well as errors")
    .option("-q, --quiet", "Suppress output on success")
    .option("--staged", "Also scan git staged files for secrets")
    .action(async (options) => {
      const code = await runScanCommand(options);
      process.exitCode = code;
    });

  program
    .command("validate")
    .description("Validate environment variables against a defined schema")
    .option("-f, --file <path>", "Environment file to validate (defaults to .env or process.env)")
    .option("-c, --config <path>", "Path to configuration file")
    .option("--format <format>", "Output format (text, json)", "text")
    .option("-o, --output <path>", "Write report to file")
    .option("--strict", "Fail on warnings as well as errors")
    .option("-q, --quiet", "Suppress output on success")
    .action(async (options) => {
      const code = await runValidateCommand(options);
      process.exitCode = code;
    });

  program
    .command("compare <source> <target>")
    .description("Compare two environment files without exposing secret values")
    .option("--format <format>", "Output format (text, json)", "text")
    .option("-o, --output <path>", "Write report to file")
    .option("--strict", "Fail on extra keys as well as missing keys")
    .option("-q, --quiet", "Suppress output on success")
    .action((source, target, options) => {
      const code = runCompareCommand(source, target, options);
      process.exitCode = code;
    });

  program
    .command("doctor")
    .description("Perform a comprehensive configuration audit of all environment files")
    .option("-c, --config <path>", "Path to configuration file")
    .option("--format <format>", "Output format (text, json)", "text")
    .option("-o, --output <path>", "Write report to file")
    .option("--strict", "Fail if any warnings exist")
    .option("-q, --quiet", "Suppress output on success")
    .action(async (options) => {
      const code = await runDoctorCommand(options);
      process.exitCode = code;
    });

  program
    .command("git-check")
    .description("Check Git repository to ensure environment files and secrets are not committed")
    .option("--format <format>", "Output format (text, json)", "text")
    .option("-o, --output <path>", "Write report to file")
    .option("-q, --quiet", "Suppress output on success")
    .option("--staged", "Scan staged files in the Git index")
    .action(async (options) => {
      const code = await runGitCheckCommand(options);
      process.exitCode = code;
    });

  program
    .command("generate-example")
    .description("Generate a clean .env.example with redacted placeholders from .env")
    .option("-f, --file <path>", "Source environment file (default: .env)", ".env")
    .option(
      "-o, --output <path>",
      "Destination example file (default: .env.example)",
      ".env.example"
    )
    .option("--force", "Overwrite destination if it already exists")
    .action((options) => {
      const code = runGenerateExampleCommand(options);
      process.exitCode = code;
    });

  program
    .command("init")
    .description("Initialize EnvGuardian configuration, sample rules, and safe .env.example")
    .option("-y, --yes", "Accept default values without prompting")
    .action(async (options) => {
      const code = await runInitCommand(options);
      process.exitCode = code;
    });

  return program;
}

export async function runCLI(args = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(args);
}
