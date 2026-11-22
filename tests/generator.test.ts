import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateEnvExample, inferPlaceholder } from "../src/core/generator.js";

describe("generateEnvExample and inferPlaceholder", () => {
  it("should infer safe placeholders for standard configurations", () => {
    expect(inferPlaceholder("DATABASE_URL", "postgres://admin:pass@db:5432/app")).toBe(
      "postgresql://username:password@localhost:5432/database"
    );
    expect(inferPlaceholder("PORT", "8080")).toBe("8080");
    expect(inferPlaceholder("NODE_ENV", "production")).toBe("production");
    expect(inferPlaceholder("ADMIN_EMAIL", "real@company.com")).toBe("user@example.com");
    expect(inferPlaceholder("SECRET_KEY", "super-secret-token-12345")).toBe("your-secret-key-here");
  });

  it("should preserve structure, comments, and redact secrets into safe .env.example", () => {
    const inputEnv = `
# Server Configuration
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=postgres://admin:superSecretPass@localhost:5432/app # primary db

# Credentials
JWT_SECRET=superSecretJwtToken123456
STRIPE_KEY=${["sk", "live", "1234567890abcdefghijklmnopqrstuv"].join("_")}
`;

    const res = generateEnvExample({ sourceContent: inputEnv });
    expect(res.variablesProcessed).toBe(5);
    expect(res.content).toContain("# Server Configuration");
    expect(res.content).toContain("PORT=3000");
    expect(res.content).toContain("NODE_ENV=production");
    expect(res.content).toContain(
      "DATABASE_URL=postgresql://username:password@localhost:5432/database # primary db"
    );
    expect(res.content).toContain("JWT_SECRET=your-jwt-secret-here");
    expect(res.content).toContain("STRIPE_KEY=your-stripe-key-here");

    // Must NOT contain real sensitive strings
    expect(res.content).not.toContain("superSecretPass");
    expect(res.content).not.toContain("superSecretJwtToken123456");
    expect(res.content).not.toContain(["sk", "live", "1234567890abcdefghijklmnopqrstuv"].join("_"));
  });

  it("covers framework-safe placeholder inference without retaining real values", () => {
    expect(inferPlaceholder("API_KEY", "your-api-key-here")).toBe("your-api-key-here");
    expect(inferPlaceholder("NODE_ENV", "unexpected")).toBe("development");
    expect(inferPlaceholder("PORT", "invalid")).toBe("3000");
    expect(inferPlaceholder("FEATURE_ENABLED", "true")).toBe("true");
    expect(inferPlaceholder("MYSQL_DB_URL", "mysql://root:secret@db/app")).toBe(
      "mysql://username:password@localhost:3306/database"
    );
    expect(inferPlaceholder("MONGO_URI", "mongodb://db/app")).toBe(
      "mongodb://localhost:27017/database"
    );
    expect(inferPlaceholder("REDIS_DB_URL", "redis://db/0")).toBe("redis://localhost:6379");
    expect(inferPlaceholder("API_ENDPOINT", "https://private.internal")).toBe(
      "https://api.example.com"
    );
    expect(inferPlaceholder("SERVICE_HOST", "private.internal")).toBe("localhost");
    expect(inferPlaceholder("DEBUG", "enabled")).toBe("false");
  });

  it("guards missing sources and existing output files", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "envguardian-generator-test-"));
    const missing = path.join(tempDir, "missing.env");
    const output = path.join(tempDir, ".env.example");
    fs.writeFileSync(output, "EXISTING=true\n", "utf8");

    expect(() => generateEnvExample({ sourceFile: missing })).toThrow("does not exist");
    expect(() => generateEnvExample({ sourceContent: "PORT=3000\n", outputFile: output })).toThrow(
      "already exists"
    );

    const written = generateEnvExample({
      sourceContent: "PORT=3000\n",
      outputFile: output,
      overwrite: true
    });
    expect(written.written).toBe(true);
    expect(fs.readFileSync(output, "utf8")).toBe("PORT=3000\n");
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
