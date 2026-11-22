import type { Diagnostic } from "../types/diagnostic.js";

/**
 * Generates OASIS SARIF (Static Analysis Results Interchange Format) 2.1.0
 * JSON string for GitHub Code Scanning and IDE diagnostic viewers.
 */
export function formatSarifReport(diagnostics: Diagnostic[]): string {
  const rulesMap = new Map<string, { id: string; name: string; shortDescription: string }>();

  for (const d of diagnostics) {
    if (!rulesMap.has(d.ruleId)) {
      rulesMap.set(d.ruleId, {
        id: d.ruleId,
        name: d.ruleId.replace(/[^a-zA-Z0-9]/g, "_"),
        shortDescription: d.message
      });
    }
  }

  const sarif = {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "EnvGuardian",
            version: "1.0.0",
            informationUri: "https://github.com/adityaarora/envguardian",
            rules: Array.from(rulesMap.values()).map((r) => ({
              id: r.id,
              name: r.name,
              shortDescription: {
                text: r.shortDescription
              }
            }))
          }
        },
        results: diagnostics.map((d) => {
          let level: "error" | "warning" | "note" = "note";
          if (d.severity === "error") level = "error";
          else if (d.severity === "warning") level = "warning";

          return {
            ruleId: d.ruleId,
            level,
            message: {
              text: `${d.message}${d.maskedValue ? ` [Value: ${d.maskedValue}]` : ""}`
            },
            locations: d.file
              ? [
                  {
                    physicalLocation: {
                      artifactLocation: {
                        uri: d.file.replace(/\\/g, "/")
                      },
                      region: {
                        startLine: d.line || 1,
                        startColumn: d.column || 1,
                        endColumn: d.endColumn || (d.column ? d.column + 1 : 1)
                      }
                    }
                  }
                ]
              : []
          };
        })
      }
    ]
  };

  return JSON.stringify(sarif, null, 2);
}
