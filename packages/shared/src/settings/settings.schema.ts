import { z } from "zod";

import {
  emailSchema,
  nameSchema,
  newPasswordSchema,
  PASSWORD_MAX_LENGTH,
} from "../auth/auth.schema.js";

/**
 * Settings & personalisation (M11, docs/architecture/settings.md): the profile, preferences that
 * follow the user across devices, reminder switches (Notifications reads them) and security.
 */

const currentPassword = z
  .string()
  .min(1, "Enter your current password")
  .max(PASSWORD_MAX_LENGTH, "That password isn't right");

/** Changing the email (the sign-in name) needs the current password. */
export const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    currentPassword: currentPassword.optional(),
  })
  .refine((value) => !value.email || value.currentPassword, {
    path: ["currentPassword"],
    message: "Enter your current password to change your email",
  });
export type UpdateProfileValues = z.output<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword,
  newPassword: newPasswordSchema,
});
export type ChangePasswordValues = z.output<typeof changePasswordSchema>;

/** Deleting the account is for good: the password, and the word typed out. */
export const deleteAccountSchema = z.object({
  password: currentPassword,
  confirm: z.literal("DELETE", { error: "Type DELETE to confirm" }),
});
export type DeleteAccountValues = z.output<typeof deleteAccountSchema>;

/** A profile photo: JPEG, PNG or WebP up to 5 MB, straight to storage like documents. */
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const createAvatarUploadSchema = z.object({
  contentType: z.enum(AVATAR_TYPES, { error: "Use a JPEG, PNG or WebP photo" }),
  size: z
    .number()
    .int()
    .min(1, "The photo is empty")
    .max(MAX_AVATAR_BYTES, "Use a photo of 5 MB or less"),
});
export type CreateAvatarUploadValues = z.output<typeof createAvatarUploadSchema>;

export const ThemePreference = { DARK: "DARK", LIGHT: "LIGHT", SYSTEM: "SYSTEM" } as const;
export type ThemePreference = (typeof ThemePreference)[keyof typeof ThemePreference];

export interface NotificationPreferences {
  /** Off: no reminders at all, whatever the switches below say. */
  enabled: boolean;
  documents: boolean;
  maintenance: boolean;
  payments: boolean;
  trips: boolean;
  /** A full tank's mileage well below the vehicle's average. */
  fuel: boolean;
  monthlySummary: boolean;
}

const clock = z
  .string({ error: "Use HH:MM, e.g. 22:00" })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM, e.g. 22:00");

/** No pushes between `start` and `end` (India time; may cross midnight). */
export interface QuietHours {
  start: string;
  end: string;
}

/**
 * Reminder timing defaults: reminder days for new documents, the "due soon" lead for schedules
 * that don't set their own, and reminder days for new recurring payments and loan EMIs.
 */
export interface ReminderTiming {
  documentDays: number[];
  serviceLeadDays: number;
  serviceLeadKm: number;
  paymentDays: number;
}
export const DEFAULT_REMINDER_TIMING: ReminderTiming = {
  documentDays: [30, 7, 1],
  serviceLeadDays: 30,
  serviceLeadKm: 1000,
  paymentDays: 3,
};
const wholeDays = (max: number) =>
  z.coerce
    .number({ error: "Enter a number of days" })
    .int("Use whole days")
    .min(0, `Use 0 to ${max} days`)
    .max(max, `Use 0 to ${max} days`);

export const updatePreferencesSchema = z.object({
  reminderTiming: z
    .object({
      documentDays: z
        .array(wholeDays(365))
        .min(1, "Choose at least one reminder")
        .max(5, "Choose up to 5 reminders"),
      serviceLeadDays: wholeDays(365),
      serviceLeadKm: z.coerce
        .number({ error: "Enter a distance in km" })
        .int("Use whole km")
        .min(0, "Use 0 to 50,000 km")
        .max(50_000, "Use 0 to 50,000 km"),
      paymentDays: wholeDays(60),
    })
    .partial()
    .optional(),
  theme: z.enum(ThemePreference).optional(),
  /** null: no quiet hours. */
  quietHours: z
    .object({ start: clock, end: clock })
    .refine((value) => value.start !== value.end, {
      path: ["end"],
      message: "Choose an end different from the start",
    })
    .nullable()
    .optional(),
  defaultVehicleId: z.uuid("Choose a vehicle").nullable().optional(),
  notifications: z
    .object({
      enabled: z.boolean(),
      documents: z.boolean(),
      maintenance: z.boolean(),
      payments: z.boolean(),
      trips: z.boolean(),
      fuel: z.boolean(),
      monthlySummary: z.boolean(),
    })
    .partial()
    .optional(),
});
export type UpdatePreferencesValues = z.output<typeof updatePreferencesSchema>;

/** Fixed for India today; shown so users know what the app assumes. */
export const REGIONAL_FORMAT = {
  currency: "INR",
  distanceUnit: "km",
  dateFormat: "DD/MM/YYYY",
  timeZone: "Asia/Kolkata",
  language: "en-IN",
} as const;

export interface UserPreferences {
  theme: ThemePreference;
  /** Opened first on sign-in; null: the first vehicle. */
  defaultVehicleId: string | null;
  notifications: NotificationPreferences;
  regional: typeof REGIONAL_FORMAT;
  quietHours: QuietHours | null;
  reminderTiming: ReminderTiming;
}

export interface SessionInfo {
  id: string;
  /** "Chrome on Windows", from the user agent; "Unknown device" without one. */
  device: string;
  createdAt: string;
  lastUsedAt: string;
  /** "Keep me signed in". */
  persistent: boolean;
  /** The device this request came from. */
  current: boolean;
}

/** Whether `time` ("HH:MM", India time) falls in quiet hours (start included, end not). */
export function inQuietHours(quiet: QuietHours | null, time: string): boolean {
  if (!quiet) return false;
  const { start, end } = quiet;
  return start < end ? time >= start && time < end : time >= start || time < end;
}
