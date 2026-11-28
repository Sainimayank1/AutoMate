import { z } from "zod";

/** Auth contract shared by apps/api (validation) and apps/web (forms). */

export const PASSWORD_MIN_LENGTH = 8;
/** Bounded so a huge body can't make argon2 hash megabytes. */
export const PASSWORD_MAX_LENGTH = 128;

/** Trimmed and lower-cased before validation, so "Arjun@Example.in " and "arjun@example.in" are one account. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email address is too long")
  .pipe(z.email("Enter a valid email address"));

export const loginSchema = z.object({
  email: emailSchema,
  // No strength rules on login: only the registration policy applies to new passwords.
  password: z
    .string()
    .min(1, "Enter your password")
    .max(PASSWORD_MAX_LENGTH, "Incorrect email or password"),
  /** true: the session survives a browser restart (30 days); false: it ends with the browser session. */
  rememberMe: z.boolean().default(true),
});

/** The policy for any new password (registration and changing it). */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use ${PASSWORD_MAX_LENGTH} characters or fewer`)
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Enter your full name")
  .max(80, "Name must be 80 characters or fewer");

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: newPasswordSchema,
  acceptedTerms: z
    .boolean()
    .refine((accepted) => accepted, "Accept the Terms of Service and Privacy Policy to continue"),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterValues = z.output<typeof registerSchema>;

/** The signed-in user as the API returns it. Never includes the password hash. */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  /** A short-lived link to the profile photo; null without one. */
  avatarUrl: string | null;
  /** ISO 8601 */
  createdAt: string;
}

/**
 * Returned by register, login and refresh. The refresh token is never in the body:
 * it travels only in an httpOnly cookie.
 */
export interface AuthSession {
  user: UserProfile;
  accessToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}
