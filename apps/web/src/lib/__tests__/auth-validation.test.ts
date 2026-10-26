import { describe, expect, it } from "vitest";
import { validateAuth } from "../auth-validation";

describe("validateAuth", () => {
  it("requires both fields", () => {
    expect(validateAuth("signin", "", "")).toEqual({ email: "Enter your email address.", password: "Enter your password." });
  });
  it("rejects malformed emails", () => {
    for (const bad of ["abc", "a@b", "a b@c.com", "@x.com"]) {
      expect(validateAuth("signin", bad, "x").email).toMatch(/valid email/);
    }
    expect(validateAuth("signin", " name@example.com ", "x")).toEqual({});
  });
  it("enforces the minimum length only when creating an account", () => {
    expect(validateAuth("signin", "a@b.co", "short")).toEqual({});
    expect(validateAuth("signup", "a@b.co", "short").password).toMatch(/8 characters/);
    expect(validateAuth("signup", "a@b.co", "longenough")).toEqual({});
  });
});

import { cleanCode, validateCode } from "../auth-validation";

describe("verification code", () => {
  it("keeps only up to six digits", () => {
    expect(cleanCode("12a 34-56789")).toBe("123456");
    expect(cleanCode("")).toBe("");
  });
  it("requires six digits", () => {
    expect(validateCode("")).toMatch(/Enter the 6-digit/);
    expect(validateCode("123")).toMatch(/6 digits/);
    expect(validateCode("123456")).toBeUndefined();
  });
});

import { validateReset } from "../auth-validation";

describe("validateReset", () => {
  it("needs a 6-digit code and a long enough new password", () => {
    expect(validateReset("", "")).toEqual({ code: "Enter the 6-digit code from your email.", password: "Enter a new password." });
    expect(validateReset("123456", "short").password).toMatch(/8 characters/);
    expect(validateReset("123456", "longenough")).toEqual({});
  });
});
