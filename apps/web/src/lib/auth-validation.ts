export type AuthMode = "signin" | "signup";
export type AuthFieldErrors = { email?: string; password?: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Client-side checks only to save a round trip; the API validates again. */
export function validateAuth(mode: AuthMode, email: string, password: string): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const e = email.trim();
  if (!e) errors.email = "Enter your email address.";
  else if (!EMAIL.test(e)) errors.email = "Enter a valid email address, like name@example.com.";
  if (!password) errors.password = "Enter your password.";
  else if (mode === "signup" && password.length < 8) errors.password = "Use at least 8 characters.";
  return errors;
}

/** Strips anything that is not a digit and caps at the 6 digits of a verification code. */
export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}

export function validateCode(code: string): string | undefined {
  if (code.length === 0) return "Enter the 6-digit code from your email.";
  if (code.length !== 6) return "The code has 6 digits.";
  return undefined;
}

export type ResetErrors = { code?: string; password?: string };

export function validateReset(code: string, password: string): ResetErrors {
  const errors: ResetErrors = {};
  const codeProblem = validateCode(code);
  if (codeProblem) errors.code = codeProblem;
  if (!password) errors.password = "Enter a new password.";
  else if (password.length < 8) errors.password = "Use at least 8 characters.";
  return errors;
}
