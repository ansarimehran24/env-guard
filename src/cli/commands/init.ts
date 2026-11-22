import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { discoverEnvFiles } from "../../core/scanner.js";
import { parseEnvContent } from "../../core/parser.js";
import { generateEnvExample } from "../../core/generator.js";

export interface InitOptions {
  yes?: boolean;
  cwd?: string;
}

/**
 * Initializes EnvGuardian configuration, safely creates .env.example if missing,
 * and configures npm scripts.
 */
export async function runInitCommand(options: InitOptions = {}): Promise<number> {
  const cwd = options.cwd || process.cwd();
  console.log(pc.bold("\n🚀 EnvGuardian Initialization Wizard\n"));

  // 1. Detect project type
  let projectType = "Node.js application";
  const pkgPath = path.join(cwd, "package.json");
  let pkgData: any = null;

  if (fs.existsSync(pkgPath)) {
    try {
      pkgData = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const deps = { ...(pkgData.dependencies || {}), ...(pkgData.devDependencies || {}) };
      if ("next" in deps) projectType = "Next.js application";
      else if ("vite" in deps) projectType = "Vite application";
      else if ("express" in deps) projectType = "Express application";
      else if ("fastify" in deps) projectType = "Fastify application";
      else if ("react" in deps) projectType = "React application";
      else if ("@nestjs/core" in deps) projectType = "NestJS application";
    } catch {
      // ignore
    }
  }
  console.log(`Detected project type: ${pc.cyan(projectType)}`);

  // 2. Search for existing environment files
  const existingEnvs = discoverEnvFiles(cwd);
  console.log(
    `Found environment files: ${existingEnvs.length > 0 ? pc.green(existingEnvs.join(", ")) : pc.yellow("None")}`
  );

  // 3. Infer schema from primary .env if available
  const primaryEnvPath = path.join(cwd, ".env");
  const inferredSchema: Record<string, any> = {};

  if (fs.existsSync(primaryEnvPath)) {
    const parsed = parseEnvContent(fs.readFileSync(primaryEnvPath, "utf8"), ".env");
    for (const entry of parsed.file.entries) {
      const kUpper = entry.key.toUpperCase();
      if (kUpper === "PORT" || kUpper.endsWith("_PORT")) {
        inferredSchema[entry.key] = { type: "port", default: 3000 };
      } else if (kUpper.includes("URL") || kUpper.includes("URI")) {
        inferredSchema[entry.key] = { type: "url", required: true };
      } else if (kUpper === "NODE_ENV") {
        inferredSchema[entry.key] = {
          type: "enum",
          values: ["development", "production", "test"],
          default: "development"
        };
      } else if (kUpper.includes("EMAIL")) {
        inferredSchema[entry.key] = { type: "email", required: true };
      } else if (entry.value === "true" || entry.value === "false") {
        inferredSchema[entry.key] = { type: "boolean", default: entry.value === "true" };
      } else {
        inferredSchema[entry.key] = { type: "string", required: true };
      }
    }
  }

  // 4. Create config file
  const configPath = path.join(cwd, "envguardian.config.json");
  if (!fs.existsSync(configPath)) {
    const configContent = {
      $schema: "https://raw.githubusercontent.com/adityaarora/envguardian/main/schema.json",
      files: existingEnvs.length > 0 ? existingEnvs : [".env"],
      schema:
        Object.keys(inferredSchema).length > 0
          ? inferredSchema
          : {
              PORT: { type: "port", default: 3000 },
              NODE_ENV: {
                type: "enum",
                values: ["development", "production", "test"],
                default: "development"
              }
            },
      scan: {
        secrets: true,
        gitSafety: true,
        frameworkSafety: true
      },
      ignore: ["node_modules", "dist", "coverage"]
    };

    fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2) + "\n", "utf8");
    console.log(pc.green(`✔ Created configuration file: ${pc.bold("envguardian.config.json")}`));
  } else {
    console.log(
      pc.yellow(
        `Configuration file already exists at ${pc.bold("envguardian.config.json")} (skipping)`
      )
    );
  }

  // 5. Create .env.example safely if missing
  const examplePath = path.join(cwd, ".env.example");
  if (!fs.existsSync(examplePath) && fs.existsSync(primaryEnvPath)) {
    try {
      generateEnvExample({
        sourceFile: primaryEnvPath,
        outputFile: examplePath,
        overwrite: false
      });
      console.log(pc.green(`✔ Created safe ${pc.bold(".env.example")} with redacted placeholders`));
    } catch {
      // ignore
    }
  }

  // 6. Add NPM scripts if package.json exists
  if (pkgData && fs.existsSync(pkgPath)) {
    let updated = false;
    pkgData.scripts = pkgData.scripts || {};
    if (!pkgData.scripts["env:check"]) {
      pkgData.scripts["env:check"] = "envguardian doctor";
      updated = true;
    }
    if (!pkgData.scripts["env:validate"]) {
      pkgData.scripts["env:validate"] = "envguardian validate";
      updated = true;
    }
    if (updated) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2) + "\n", "utf8");
      console.log(pc.green(`✔ Added scripts "env:check" and "env:validate" to package.json`));
    }
  }

  console.log(pc.bold("\nInitialization complete! Next steps:"));
  console.log(`  1. Run ${pc.cyan("npx envguardian doctor")} to audit your environment.`);
  console.log(`  2. Run ${pc.cyan("npx envguardian validate")} to test schema validation.`);
  console.log(`  3. Run ${pc.cyan("npx envguardian git-check")} to verify Git safety.\n`);

  return 0;
}
