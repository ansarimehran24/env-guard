import { describe, it, expect } from "vitest";
import { parseEnvContent } from "../src/core/parser.js";

describe("parseEnvContent", () => {
  it("should parse valid key-value pairs with comments and empty lines", () => {
    const raw = `
# System configuration
PORT=8080
HOST=127.0.0.1 # local bind

# Feature flags
ENABLE_FEATURE=true
`;
    const { file, diagnostics } = parseEnvContent(raw, ".env");
    expect(file.entries).toHaveLength(3);
    expect(file.entries[0].key).toBe("PORT");
    expect(file.entries[0].value).toBe("8080");
    expect(file.entries[1].key).toBe("HOST");
    expect(file.entries[1].value).toBe("127.0.0.1");
    expect(file.entries[1].comment).toBe("local bind");
    expect(file.entries[2].key).toBe("ENABLE_FEATURE");
    expect(file.entries[2].value).toBe("true");
    expect(diagnostics).toHaveLength(0);
  });

  it("should handle double and single quoted values and escape sequences", () => {
    const raw = `
GREETING="Hello\\nWorld"
SINGLE_QUOTE='Simple string'
WITH_QUOTES="Value \\"with\\" quotes"
`;
    const { file, diagnostics } = parseEnvContent(raw, ".env");
    expect(file.entries[0].value).toBe("Hello\nWorld");
    expect(file.entries[1].value).toBe("Simple string");
    expect(file.entries[2].value).toBe('Value "with" quotes');
    expect(diagnostics).toHaveLength(0);
  });

  it("should detect duplicate keys", () => {
    const raw = `
DATABASE_URL=postgres://localhost/db1
DATABASE_URL=postgres://localhost/db2
`;
    const { file, diagnostics } = parseEnvContent(raw, ".env");
    expect(file.entries).toHaveLength(2);
    const dupDiag = diagnostics.find((d) => d.ruleId === "syntax/duplicate-key");
    expect(dupDiag).toBeDefined();
    expect(dupDiag?.message).toContain("Duplicate declaration");
    expect(dupDiag?.line).toBe(3);
  });

  it("should detect unclosed quotes", () => {
    const raw = `SECRET="unclosed string`;
    const { diagnostics } = parseEnvContent(raw, ".env");
    const unclosed = diagnostics.find((d) => d.ruleId === "syntax/unclosed-quote");
    expect(unclosed).toBeDefined();
    expect(unclosed?.severity).toBe("error");
  });

  it("should detect trailing characters after closing quote", () => {
    const raw = `NAME="Alice" extra_chars`;
    const { diagnostics } = parseEnvContent(raw, ".env");
    const trailing = diagnostics.find((d) => d.ruleId === "syntax/trailing-characters");
    expect(trailing).toBeDefined();
    expect(trailing?.severity).toBe("warning");
  });

  it("should detect malformed assignments missing equals sign", () => {
    const raw = `INVALID_LINE_WITHOUT_EQUALS`;
    const { diagnostics } = parseEnvContent(raw, ".env");
    const malformed = diagnostics.find((d) => d.ruleId === "syntax/malformed-assignment");
    expect(malformed).toBeDefined();
    expect(malformed?.severity).toBe("error");
  });

  it("should detect invalid variable names", () => {
    const raw = `123BAD_KEY=val\nBAD-KEY=val`;
    const { diagnostics } = parseEnvContent(raw, ".env");
    const invalidNames = diagnostics.filter((d) => d.ruleId === "syntax/invalid-key-name");
    expect(invalidNames).toHaveLength(2);
  });

  it("should flag suspicious whitespace around equals sign", () => {
    const raw = `FOO = bar`;
    const { diagnostics } = parseEnvContent(raw, ".env");
    const whitespace = diagnostics.find((d) => d.ruleId === "syntax/suspicious-whitespace");
    expect(whitespace).toBeDefined();
  });

  it("should record info diagnostic for empty values", () => {
    const raw = `EMPTY_VAL=`;
    const { file, diagnostics } = parseEnvContent(raw, ".env");
    expect(file.entries[0].value).toBe("");
    const emptyDiag = diagnostics.find((d) => d.ruleId === "syntax/empty-value");
    expect(emptyDiag).toBeDefined();
    expect(emptyDiag?.severity).toBe("info");
  });
});
