# Settings & personalisation (M11): design

The profile, preferences that follow the account, reminder switches, password, signed-in devices and deleting the account. Product scope: [MODULES.md M11](../MODULES.md#module-11--settings--personalization).

## 1. Rules

- **Profile:** name and email. Changing the email needs the current password (`400` with a `currentPassword` field error otherwise); an email in use is `409`. The photo goes straight to storage like documents (JPEG, PNG or WebP up to 5 MB, magic bytes checked on confirm); the user row keeps only its key (`users.avatar_key`) and every profile response signs a 1-hour link (`avatarUrl`, null without one). Replacing or removing a photo deletes the old object.
- **Preferences** (`user_preferences`, created on first change): theme (`DARK` default, `LIGHT`, `SYSTEM`), the default vehicle (must be the user's own; `SetNull` when it's deleted) and the reminder switches. The web applies the theme and default vehicle once per sign-in (`PreferenceSync`); later changes on that device win until the next sign-in. The header's theme toggle saves to the account too.
- **Regional format** is fixed for India (`REGIONAL_FORMAT`: ₹, km, DD/MM/YYYY, Asia/Kolkata, en-IN) and shown read-only.
- **Reminder switches:** a master switch (off: no reminders at all) plus documents, maintenance, payments (recurring payments and EMIs), trips, mileage drops and the monthly summary (off by default). Notifications (M10) reads them through `SettingsService.preferences`. Timing stays where it is set today: on each document (`reminderDays`) and each maintenance schedule.
- **Dashboard preferences** are the dashboard's own "Customise" layout (`dashboard.md`), not repeated here.
- **Password:** the current one is checked; the new one follows the sign-up rule. Changing it signs every other device out (their refresh sessions are deleted, so their access tokens fail on the next request).
- **Devices:** one row per refresh session, named from the user agent (`device.ts`: "Chrome on Windows", "Safari on iPhone", "Unknown device"), with "This device" for the caller's. Sign out one (`404` if it isn't the user's) or every other one.
- **Delete account:** the password plus the word `DELETE`. The user row is deleted with everything that cascades from it, then its stored files (documents and the photo), then the refresh cookie is cleared. There is no undo.

## 2. API

| Endpoint                                        | Notes                                                         |
| ----------------------------------------------- | ------------------------------------------------------------- |
| `PATCH /users/me`                               | `name`, `email` (+ `currentPassword`). Returns the profile.   |
| `POST /users/me/avatar/uploads`                 | `contentType`, `size`: an upload slot, as for documents.      |
| `POST /users/me/avatar/uploads/:fileId/confirm` | Checks the object and returns the profile with the photo.     |
| `DELETE /users/me/avatar`                       | Removes the photo; returns the profile.                       |
| `GET` / `PATCH /users/me/preferences`           | Theme, default vehicle, partial `notifications`, regional.    |
| `POST /auth/password`                           | `currentPassword`, `newPassword`; `204`.                      |
| `GET /auth/sessions`                            | Paginated devices, the caller's marked `current`.             |
| `DELETE /auth/sessions/:id`                     | Signs one device out; `204`.                                  |
| `POST /auth/sessions/revoke-others`             | `{ signedOut }`.                                              |
| `POST /users/me/delete`                         | `password`, `confirm: "DELETE"`; `204` and clears the cookie. |

Tested in `test/settings.e2e-spec.ts`, `device.spec.ts` and `settings.test.tsx`.

## 3. Not built

Biometric app lock and an app PIN (mobile app only), languages, currencies and units other than India's (the format is fixed), privacy settings (there is no tracking or sharing to control) and email change verification (needs an email provider, like forgotten passwords). The page follows the Stitch screens "Settings — Security & Preferences" (desktop and mobile).
