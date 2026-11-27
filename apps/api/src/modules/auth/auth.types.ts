/** Claims inside an AutoMate access token. `sub` is the user id. */
export interface AccessTokenPayload {
  sub: string;
}

/** The authenticated principal JwtStrategy attaches to `request.user`. */
export interface AuthUser {
  id: string;
}
