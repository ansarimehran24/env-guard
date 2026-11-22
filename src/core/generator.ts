import fs from "node:fs";
import { parseEnvContent } from "./parser.js";
import { isPlaceholderOrExample } from "../security/redaction.js";

export interface GenerateExampleOptions {
  sourceFile?: string;
  sourceContent?: string;
  outputFile?: string;
  overwrite?: boolean;
}

export interface GenerateExampleResult {
  content: string;
  outputFile?: string;
  written: boolean;
  variablesProcessed: number;
}

/**
 * Infers a safe, non-sensitive placeholder value for an environment variable.
 */
export function inferPlaceholder(key: string, originalVal: string): string {
  const keyUpper = key.toUpperCase();

  // If already a safe placeholder, retain it
  if (isPlaceholderOrExample(originalVal)) {
    return originalVal;
  }

  // Safe standard environment settings
  if (keyUpper === "NODE_ENV") {
    const validEnvs = ["development", "production", "test", "staging"];
    return validEnvs.includes(originalVal.toLowerCase())
      ? originalVal.toLowerCase()
      : "development";
  }

  // Safe port numbers
  if (keyUpper === "PORT" || keyUpper.endsWith("_PORT")) {
    const num = Number(originalVal);
    if (!isNaN(num) && num > 0 && num <= 65535) {
      return String(num);
    }
    return "3000";
  }

  // Booleans
  if (originalVal === "true" || originalVal === "false") {
    return originalVal;
  }

  // Database URLs
  if (
    keyUpper.includes("DATABASE_URL") ||
    keyUpper.includes("DB_URL") ||
    keyUpper.includes("MONGO_URI")
  ) {
    if (originalVal.startsWith("postgres") || keyUpper.includes("POSTGRES")) {
      return "postgresql://username:password@localhost:5432/database";
    }
    if (originalVal.startsWith("mysql") || keyUpper.includes("MYSQL")) {
      return "mysql://username:password@localhost:3306/database";
    }
    if (originalVal.startsWith("mongodb") || keyUpper.includes("MONGO")) {
      return "mongodb://localhost:27017/database";
    }
    if (originalVal.startsWith("redis") || keyUpper.includes("REDIS")) {
      return "redis://localhost:6379";
    }
    return "postgresql://username:password@localhost:5432/database";
  }

  // URLs
  if (keyUpper.endsWith("_URL") || keyUpper.endsWith("_URI") || keyUpper.endsWith("_ENDPOINT")) {
    return "https://api.example.com";
  }

  // Hosts / Domains
  if (keyUpper.endsWith("_HOST") || keyUpper === "HOST") {
    return "localhost";
  }

  // Emails
  if (keyUpper.includes("EMAIL") || keyUpper.includes("MAIL")) {
    return "user@example.com";
  }

  // Debug flags
  if (keyUpper === "DEBUG") {
    return "false";
  }

  // Default conservative placeholder: never leak the real value
  const slug = key.toLowerCase().replace(/_/g, "-");
  return `your-${slug}-here`;
}

/**
 * Generates a clean, safe .env.example file from an existing .env file
 * while preserving structure, comments, and redacting all potential secrets.
 */
export function generateEnvExample(options: GenerateExampleOptions = {}): GenerateExampleResult {
  const sourcePath = options.sourceFile || ".env";
  const sourceContent =
    options.sourceContent ?? (fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, "utf8") : "");

  if (!sourceContent && !options.sourceContent) {
    throw new Error(`Source environment file "${sourcePath}" does not exist`);
  }

  const { file } = parseEnvContent(sourceContent, sourcePath);
  const outLines: string[] = [];
  const processedKeys = new Set<string>();

  for (const rawLine of file.rawLines) {
    const trimmed = rawLine.trim();

    // Preserve comments and empty lines
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      outLines.push(rawLine);
      continue;
    }

    const eqIdx = rawLine.indexOf("=");
    if (eqIdx === -1) {
      outLines.push(rawLine);
      continue;
    }

    const rawKeyPart = rawLine.slice(0, eqIdx);
    const key = rawKeyPart.trim();

    // Find the parsed entry
    const entry = file.entries.find((e) => e.key === key && e.raw === rawLine);
    const originalVal = entry ? entry.value : rawLine.slice(eqIdx + 1).trim();

    const placeholder = inferPlaceholder(key, originalVal);
    processedKeys.add(key);

    let line = `${key}=${placeholder}`;
    if (entry?.comment) {
      line += ` # ${entry.comment}`;
    }

    outLines.push(line);
  }

  const generatedContent = `${outLines.join("\n").replace(/\n+$/, "")}\n`;
  let written = false;

  if (options.outputFile) {
    if (fs.existsSync(options.outputFile) && !options.overwrite) {
      throw new Error(
        `Output file "${options.outputFile}" already exists. Use --force to overwrite.`
      );
    }
    fs.writeFileSync(options.outputFile, generatedContent, "utf8");
    written = true;
  }

  return {
    content: generatedContent,
    outputFile: options.outputFile,
    written,
    variablesProcessed: processedKeys.size
  };
}
