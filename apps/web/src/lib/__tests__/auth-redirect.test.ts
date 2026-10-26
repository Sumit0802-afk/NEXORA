import { describe, expect, it } from "vitest";
import { loginUrl, safeNext } from "../auth-redirect";

describe("auth redirects", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/studio/abc/3d?x=1")).toBe("/studio/abc/3d?x=1");
  });
  it("blocks open redirects and loops", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "/login", "", null, undefined]) {
      expect(safeNext(bad as string)).toBe("/");
    }
  });
  it("builds the login url with the return path", () => {
    expect(loginUrl("/studio/abc")).toBe("/login?next=%2Fstudio%2Fabc");
    expect(loginUrl("/")).toBe("/login");
  });
});
