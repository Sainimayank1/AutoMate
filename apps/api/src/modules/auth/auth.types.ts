/** Claims inside an AutoMate access token. */
export interface AccessTokenPayload {
  /** User id. */
  sub: string;
  /** Session id (`sessions.id`). The token is only valid while that session exists. */
  sid: string;
}

/** The authenticated principal JwtStrategy attaches to `request.user`. */
export interface AuthUser {
  id: string;
  /** This device's session, e.g. to sign it out or mark it "current" in a sessions list. */
  sessionId: string;
}
