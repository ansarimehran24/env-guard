#!/usr/bin/env node

// EnvGuardian CLI launcher
import("../dist/cli.js").then((cli) => {
  if (cli && typeof cli.runCLI === "function") {
    cli.runCLI().catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(2);
    });
  }
}).catch((err) => {
  console.error("Failed to load EnvGuardian CLI:", err);
  process.exit(2);
});
