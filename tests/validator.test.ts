import { describe, it, expect } from "vitest";
import { validateEnv } from "../src/core/validator.js";

describe("validateEnv", () => {
  it("should validate strings and nonempty_strings", () => {
    const env = {
      APP_NAME: "EnvGuardian",
      EMPTY_STR: "   "
    };

    const res = validateEnv(env, {
      APP_NAME: { type: "nonempty_string", required: true },
      EMPTY_STR: { type: "nonempty_string", required: true }
    });

    expect(res.valid).toBe(false);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].key).toBe("EMPTY_STR");
    expect(res.data.APP_NAME).toBe("EnvGuardian");
  });

  it("should validate numbers, integers, and ports", () => {
    const env = {
      PORT: "3000",
      FLOAT_NUM: "3.14",
      BAD_INT: "4.5",
      BAD_PORT: "70000"
    };

    const res = validateEnv(env, {
      PORT: { type: "port", required: true },
      FLOAT_NUM: { type: "number", required: true },
      BAD_INT: { type: "integer", required: true },
      BAD_PORT: { type: "port", required: true }
    });

    expect(res.valid).toBe(false);
    expect(res.data.PORT).toBe(3000);
    expect(res.data.FLOAT_NUM).toBe(3.14);
    expect(res.errors.find((e) => e.key === "BAD_INT")).toBeDefined();
    expect(res.errors.find((e) => e.key === "BAD_PORT")).toBeDefined();
  });

  it("should validate booleans (true/false, 1/0, yes/no)", () => {
    const env = {
      BOOL_A: "true",
      BOOL_B: "0",
      BOOL_C: "yes",
      BOOL_BAD: "maybe"
    };

    const res = validateEnv(env, {
      BOOL_A: { type: "boolean" },
      BOOL_B: { type: "boolean" },
      BOOL_C: { type: "boolean" },
      BOOL_BAD: { type: "boolean" }
    });

    expect(res.data.BOOL_A).toBe(true);
    expect(res.data.BOOL_B).toBe(false);
    expect(res.data.BOOL_C).toBe(true);
    expect(res.errors.find((e) => e.key === "BOOL_BAD")).toBeDefined();
  });

  it("should validate URLs and Emails", () => {
    const env = {
      API_URL: "https://api.example.com/v1",
      BAD_URL: "not_a_valid_url",
      ADMIN_EMAIL: "admin@example.com",
      BAD_EMAIL: "admin-at-example.com"
    };

    const res = validateEnv(env, {
      API_URL: { type: "url", required: true },
      BAD_URL: { type: "url", required: true },
      ADMIN_EMAIL: { type: "email", required: true },
      BAD_EMAIL: { type: "email", required: true }
    });

    expect(res.valid).toBe(false);
    expect(res.data.API_URL).toBe("https://api.example.com/v1");
    expect(res.data.ADMIN_EMAIL).toBe("admin@example.com");
    expect(res.errors.find((e) => e.key === "BAD_URL")).toBeDefined();
    expect(res.errors.find((e) => e.key === "BAD_EMAIL")).toBeDefined();
  });

  it("should validate enums and allowed values", () => {
    const env = {
      NODE_ENV: "production",
      INVALID_ENV: "qa"
    };

    const res = validateEnv(env, {
      NODE_ENV: { type: "enum", values: ["development", "production", "test"] },
      INVALID_ENV: { type: "enum", values: ["development", "production", "test"] }
    });

    expect(res.valid).toBe(false);
    expect(res.data.NODE_ENV).toBe("production");
    expect(res.errors.find((e) => e.key === "INVALID_ENV")).toBeDefined();
  });

  it("should validate JSON strings", () => {
    const env = {
      VALID_CONFIG: '{"features":{"beta":true}}',
      INVALID_CONFIG: "{bad json"
    };

    const res = validateEnv(env, {
      VALID_CONFIG: { type: "json" },
      INVALID_CONFIG: { type: "json" }
    });

    expect(res.valid).toBe(false);
    expect(res.data.VALID_CONFIG).toEqual({ features: { beta: true } });
    expect(res.errors.find((e) => e.key === "INVALID_CONFIG")).toBeDefined();
  });

  it("should enforce min/max length and numeric range limits", () => {
    const env = {
      SHORT_PASS: "123",
      HIGH_VAL: "150"
    };

    const res = validateEnv(env, {
      SHORT_PASS: { type: "string", minLength: 8 },
      HIGH_VAL: { type: "number", min: 1, max: 100 }
    });

    expect(res.valid).toBe(false);
    expect(res.errors).toHaveLength(2);
  });

  it("should support regex constraints and custom validator functions", () => {
    const env = {
      SLUG: "my-valid-slug",
      BAD_SLUG: "MY_SLUG!",
      CUSTOM_CHECK: "special-token"
    };

    const res = validateEnv(env, {
      SLUG: { type: "string", regex: /^[a-z0-9-]+$/ },
      BAD_SLUG: { type: "string", regex: /^[a-z0-9-]+$/ },
      CUSTOM_CHECK: {
        type: "string",
        custom: (val) => (val === "special-token" ? true : "Must be special-token")
      }
    });

    expect(res.valid).toBe(false);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].key).toBe("BAD_SLUG");
  });

  it("should apply default values when optional variable is not provided", () => {
    const env = {};

    const res = validateEnv(env, {
      PORT: { type: "port", default: 8080 },
      DEBUG: { type: "boolean", default: false }
    });

    expect(res.valid).toBe(true);
    expect(res.data.PORT).toBe(8080);
    expect(res.data.DEBUG).toBe(false);
  });

  it("should NOT mutate process.env", () => {
    const initialEnv = { ...process.env };
    validateEnv(process.env, {
      NON_EXISTENT_VAR: { type: "string", default: "default_val" }
    });

    expect(process.env.NON_EXISTENT_VAR).toBeUndefined();
    expect(process.env).toEqual(initialEnv);
  });
});
