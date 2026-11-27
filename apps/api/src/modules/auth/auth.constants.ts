export const JWT_ALGORITHM = "HS256";
export const JWT_ISSUER = "automate-api";
export const JWT_AUDIENCE = "automate-web";

/** Access tokens are short-lived; the refresh cookie renews them. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** httpOnly cookie holding the opaque refresh token. Scoped to the /auth routes. */
export const REFRESH_COOKIE_NAME = "automate_rt";

const DAY_MS = 24 * 60 * 60 * 1000;
/** "Keep me signed in": sliding 30 days, renewed on every refresh. */
export const PERSISTENT_SESSION_TTL_MS = 30 * DAY_MS;
/** Without it: a browser-session cookie, and the server forgets the session after a day of inactivity. */
export const BROWSER_SESSION_TTL_MS = DAY_MS;

/** Per IP, per route. Login and registration are password-guessing and account-creation targets. */
export const CREDENTIALS_RATE_LIMIT = { default: { limit: 10, ttl: 60_000 } };
export const REFRESH_RATE_LIMIT = { default: { limit: 30, ttl: 60_000 } };

export const INVALID_CREDENTIALS_MESSAGE = "Incorrect email or password.";
export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";
