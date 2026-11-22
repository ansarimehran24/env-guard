import fs from "node:fs";
import { parseEnvContent } from "./parser.js";
import type { CompareResult } from "../types/index.js";

/**
 * Heuristically infers the likely primitive type of a string value.
 */
function inferType(val: string): "number" | "boolean" | "url" | "json" | "string" {
  if (!val || val.length === 0) return "string";
  const lower = val.toLowerCase().trim();
  if (lower === "true" || lower === "false" || lower === "1" || lower === "0") return "boolean";
  if (!isNaN(Number(val)) && !isNaN(parseFloat(val))) return "number";
  if (/^https?:\/\//i.test(val)) return "url";
  if ((val.startsWith("{") && val.endsWith("}")) || (val.startsWith("[") && val.endsWith("]"))) {
    try {
      JSON.parse(val);
      return "json";
    } catch {
      // not valid json
    }
  }
  return "string";
}

/**
 * Compares two environment files (e.g., .env.example vs .env.production)
 * without ever displaying or leaking secret values.
 */
export function compareEnv(
  sourcePath: string,
  targetPath: string,
  customSourceContent?: string,
  customTargetContent?: string
): CompareResult {
  const sourceContent = customSourceContent ?? fs.readFileSync(sourcePath, "utf8");
  const targetContent = customTargetContent ?? fs.readFileSync(targetPath, "utf8");

  const sourceParsed = parseEnvContent(sourceContent, sourcePath);
  const targetParsed = parseEnvContent(targetContent, targetPath);

  const sourceKeys = new Set<string>();
  const sourceKeyMap = new Map<string, string>();
  const sourceDuplicates: string[] = [];

  for (const entry of sourceParsed.file.entries) {
    if (sourceKeys.has(entry.key)) {
      if (!sourceDuplicates.includes(entry.key)) {
        sourceDuplicates.push(entry.key);
      }
    } else {
      sourceKeys.add(entry.key);
      sourceKeyMap.set(entry.key, entry.value);
    }
  }

  const targetKeys = new Set<string>();
  const targetKeyMap = new Map<string, string>();
  const targetDuplicates: string[] = [];
  const emptyInTarget: string[] = [];

  for (const entry of targetParsed.file.entries) {
    if (targetKeys.has(entry.key)) {
      if (!targetDuplicates.includes(entry.key)) {
        targetDuplicates.push(entry.key);
      }
    } else {
      targetKeys.add(entry.key);
      targetKeyMap.set(entry.key, entry.value);
    }

    if (entry.value.trim().length === 0) {
      emptyInTarget.push(entry.key);
    }
  }

  const missingInTarget: string[] = [];
  const extraInTarget: string[] = [];
  const typeMismatches: Array<{
    key: string;
    sourceType?: string;
    targetType?: string;
    message: string;
  }> = [];

  let identicalCount = 0;

  for (const key of sourceKeys) {
    if (!targetKeys.has(key)) {
      missingInTarget.push(key);
    } else {
      identicalCount++;
      const srcVal = sourceKeyMap.get(key) || "";
      const tgtVal = targetKeyMap.get(key) || "";

      // If source is a typed value (number, boolean, url, json), check target compatibility
      if (srcVal && tgtVal) {
        const srcType = inferType(srcVal);
        const tgtType = inferType(tgtVal);

        if (srcType !== "string" && srcType !== tgtType) {
          typeMismatches.push({
            key,
            sourceType: srcType,
            targetType: tgtType,
            message: `Key "${key}" has type ${srcType} in source but appears to be ${tgtType} in target`
          });
        }
      }
    }
  }

  for (const key of targetKeys) {
    if (!sourceKeys.has(key)) {
      extraInTarget.push(key);
    }
  }

  const valid = missingInTarget.length === 0 && typeMismatches.length === 0;

  return {
    sourceFile: sourcePath,
    targetFile: targetPath,
    missingInTarget,
    extraInTarget,
    emptyInTarget,
    typeMismatches,
    duplicateKeys: {
      source: sourceDuplicates,
      target: targetDuplicates
    },
    identicalCount,
    totalKeysSource: sourceKeys.size,
    totalKeysTarget: targetKeys.size,
    valid
  };
}
