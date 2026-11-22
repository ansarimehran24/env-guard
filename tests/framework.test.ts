import { describe, it, expect } from "vitest";
import {
  isPublicFrameworkVariable,
  isPublicVariableWithSensitiveName
} from "../src/utils/framework.js";
import { scanEnv } from "../src/core/scanner.js";

describe("Framework Client Exposure Security", () => {
  it("should recognize common client-exposed framework prefixes", () => {
    expect(isPublicFrameworkVariable("NEXT_PUBLIC_API_URL")).toBe(true);
    expect(isPublicFrameworkVariable("VITE_APP_TITLE")).toBe(true);
    expect(isPublicFrameworkVariable("REACT_APP_VERSION")).toBe(true);
    expect(isPublicFrameworkVariable("EXPO_PUBLIC_API_URL")).toBe(true);
    expect(isPublicFrameworkVariable("NUXT_PUBLIC_API_URL")).toBe(true);
    expect(isPublicFrameworkVariable("GATSBY_API_URL")).toBe(true);
    expect(isPublicFrameworkVariable("INTERNAL_SECRET")).toBe(false);
  });

  it("should detect sensitive names on public client variables", () => {
    expect(isPublicVariableWithSensitiveName("NEXT_PUBLIC_FIREBASE_API_KEY")).toBe(true);
    expect(isPublicVariableWithSensitiveName("VITE_STRIPE_SECRET_KEY")).toBe(true);
    expect(isPublicVariableWithSensitiveName("NEXT_PUBLIC_NORMAL_TITLE")).toBe(false);
  });

  it("should emit an error diagnostic when public variable contains credentials", () => {
    const raw = `
NEXT_PUBLIC_ADMIN_SECRET=topSecret123
VITE_SAFE_URL=https://example.com
`;
    const res = scanEnv([{ path: ".env", content: raw }]);
    const fwDiag = res.diagnostics.find((d) => d.ruleId === "framework/public-secret-leak");
    expect(fwDiag).toBeDefined();
    expect(fwDiag?.severity).toBe("error");
    expect(fwDiag?.variableName).toBe("NEXT_PUBLIC_ADMIN_SECRET");
    expect(fwDiag?.remediation).toContain(
      "bundles variables with this prefix into client-side JavaScript"
    );
  });
});
