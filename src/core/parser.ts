import type { Diagnostic } from "../types/diagnostic.js";
import type { ParsedEnvEntry, ParsedEnvFile } from "../types/index.js";

export interface ParseEnvResult {
  file: ParsedEnvFile;
  diagnostics: Diagnostic[];
}

const VALID_KEY_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Parses a .env file content line-by-line, tracking precise line and column locations,
 * comments, quote styles, and syntax issues.
 */
export function parseEnvContent(content: string, filePath = ".env"): ParseEnvResult {
  const lines = content.split(/\r?\n/);
  const entries: ParsedEnvEntry[] = [];
  const entriesByKey = new Map<string, ParsedEnvEntry[]>();
  const diagnostics: Diagnostic[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineNumber = lineIndex + 1;
    const rawLine = lines[lineIndex];
    const trimmed = rawLine.trim();

    // Skip empty lines
    if (trimmed.length === 0) {
      continue;
    }

    // Full line comment
    if (trimmed.startsWith("#")) {
      continue;
    }

    // Assignment must have '='
    const equalsIndex = rawLine.indexOf("=");
    if (equalsIndex === -1) {
      diagnostics.push({
        ruleId: "syntax/malformed-assignment",
        message: `Line ${lineNumber} is missing '=' assignment operator`,
        severity: "error",
        file: filePath,
        line: lineNumber,
        column: 1,
        snippet: rawLine,
        remediation: "Format environment variables as KEY=VALUE."
      });
      continue;
    }

    const rawKeyPart = rawLine.slice(0, equalsIndex);
    const rawValPart = rawLine.slice(equalsIndex + 1);

    const key = rawKeyPart.trim();
    const keyCol = rawLine.indexOf(key) + 1;

    // Check for suspicious whitespace around '='
    if (
      rawKeyPart.endsWith(" ") ||
      rawKeyPart.endsWith("\t") ||
      rawValPart.startsWith(" ") ||
      rawValPart.startsWith("\t")
    ) {
      // If the value is not quoted, whitespace around '=' can cause unexpected values in some shells
      const valTrimmed = rawValPart.trim();
      if (!valTrimmed.startsWith('"') && !valTrimmed.startsWith("'")) {
        diagnostics.push({
          ruleId: "syntax/suspicious-whitespace",
          message: `Suspicious whitespace around '=' on line ${lineNumber}`,
          severity: "warning",
          file: filePath,
          line: lineNumber,
          column: equalsIndex + 1,
          snippet: rawLine,
          remediation:
            "Remove spaces around '=' or wrap the value in quotes to avoid shell interpretation issues."
        });
      }
    }

    // Check key naming syntax
    if (!VALID_KEY_REGEX.test(key)) {
      diagnostics.push({
        ruleId: "syntax/invalid-key-name",
        message: `Invalid variable name "${key}" on line ${lineNumber}`,
        severity: "error",
        file: filePath,
        line: lineNumber,
        column: keyCol,
        variableName: key,
        snippet: rawLine,
        remediation:
          "Variable names should start with a letter or underscore and contain only alphanumeric characters and underscores."
      });
    }

    // Parse value, quotes, and inline comments
    const valTrimmed = rawValPart.trim();
    let value = valTrimmed;
    let hasQuotes = false;
    let quoteChar: string | undefined;
    let comment: string | undefined;
    const valCol = equalsIndex + 1 + (rawValPart.length - rawValPart.trimStart().length) + 1;

    if (valTrimmed.startsWith('"') || valTrimmed.startsWith("'") || valTrimmed.startsWith("`")) {
      quoteChar = valTrimmed[0];
      hasQuotes = true;

      // Find matching closing quote
      let closingIndex = -1;
      let isEscaped = false;

      for (let i = 1; i < valTrimmed.length; i++) {
        const ch = valTrimmed[i];
        if (ch === "\\" && quoteChar === '"') {
          isEscaped = !isEscaped;
          continue;
        }
        if (ch === quoteChar && !isEscaped) {
          closingIndex = i;
          break;
        }
        isEscaped = false;
      }

      if (closingIndex === -1) {
        diagnostics.push({
          ruleId: "syntax/unclosed-quote",
          message: `Unclosed ${quoteChar} quote on line ${lineNumber}`,
          severity: "error",
          file: filePath,
          line: lineNumber,
          column: valCol,
          variableName: key,
          snippet: rawLine,
          remediation: `Ensure the quotation mark ${quoteChar} is properly closed.`
        });
        value = valTrimmed.slice(1);
      } else {
        const quotedContent = valTrimmed.slice(1, closingIndex);
        const afterQuote = valTrimmed.slice(closingIndex + 1).trim();

        if (afterQuote.length > 0) {
          if (afterQuote.startsWith("#")) {
            comment = afterQuote.slice(1).trim();
          } else {
            diagnostics.push({
              ruleId: "syntax/trailing-characters",
              message: `Unexpected characters after closing quote on line ${lineNumber}`,
              severity: "warning",
              file: filePath,
              line: lineNumber,
              column: valCol + closingIndex + 1,
              variableName: key,
              snippet: rawLine,
              remediation:
                "Move comments after a '#' or wrap the entire intended value inside quotes."
            });
          }
        }

        // Process escape sequences if double quoted
        if (quoteChar === '"') {
          value = quotedContent
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\");
        } else {
          value = quotedContent;
        }
      }
    } else {
      // Unquoted value: check for inline comments
      const commentIndex = valTrimmed.indexOf(" #");
      if (commentIndex !== -1) {
        comment = valTrimmed.slice(commentIndex + 2).trim();
        value = valTrimmed.slice(0, commentIndex).trim();
      } else {
        value = valTrimmed;
      }
    }

    // Check for empty values
    if (value.length === 0) {
      diagnostics.push({
        ruleId: "syntax/empty-value",
        message: `Variable "${key}" has an empty value on line ${lineNumber}`,
        severity: "info",
        file: filePath,
        line: lineNumber,
        column: valCol,
        variableName: key,
        snippet: rawLine,
        remediation: "Provide a value or remove the variable if unused."
      });
    }

    const entry: ParsedEnvEntry = {
      key,
      value,
      raw: rawLine,
      line: lineNumber,
      keyColumn: keyCol,
      valueColumn: valCol,
      hasQuotes,
      quoteChar,
      comment
    };

    entries.push(entry);

    // Track duplicates
    const existing = entriesByKey.get(key) || [];
    if (existing.length > 0) {
      diagnostics.push({
        ruleId: "syntax/duplicate-key",
        message: `Duplicate declaration of variable "${key}" on line ${lineNumber} (previously defined on line ${existing[0].line})`,
        severity: "warning",
        file: filePath,
        line: lineNumber,
        column: keyCol,
        variableName: key,
        snippet: rawLine,
        remediation: "Consolidate duplicate declarations to avoid unexpected runtime overriding."
      });
    }
    existing.push(entry);
    entriesByKey.set(key, existing);
  }

  const file: ParsedEnvFile = {
    filePath,
    entries,
    entriesByKey,
    rawLines: lines
  };

  return { file, diagnostics };
}
