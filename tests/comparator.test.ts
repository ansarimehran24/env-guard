import { describe, it, expect } from "vitest";
import { compareEnv } from "../src/core/comparator.js";

describe("compareEnv", () => {
  it("should detect missing and extra keys between two environment files", () => {
    const src = `
DATABASE_URL=postgres://localhost/db
PORT=3000
JWT_SECRET=your-secret
`;
    const tgt = `
DATABASE_URL=postgres://localhost/db
EXTRA_VAR=some_val
`;

    const res = compareEnv(".env.example", ".env.production", src, tgt);
    expect(res.valid).toBe(false);
    expect(res.missingInTarget).toEqual(["PORT", "JWT_SECRET"]);
    expect(res.extraInTarget).toEqual(["EXTRA_VAR"]);
    expect(res.identicalCount).toBe(1);
  });

  it("should detect empty values and duplicate keys", () => {
    const src = `
KEY_A=val
KEY_B=val
`;
    const tgt = `
KEY_A=
KEY_B=val
KEY_B=duplicate_val
`;

    const res = compareEnv(".env.src", ".env.tgt", src, tgt);
    expect(res.emptyInTarget).toContain("KEY_A");
    expect(res.duplicateKeys.target).toContain("KEY_B");
  });

  it("should detect type mismatches between source placeholder and target value", () => {
    const src = `PORT=3000\nDEBUG=true`;
    const tgt = `PORT=not_a_number\nDEBUG=maybe`;

    const res = compareEnv(".env.src", ".env.tgt", src, tgt);
    expect(res.typeMismatches.length).toBeGreaterThan(0);
    expect(res.valid).toBe(false);
  });
});
