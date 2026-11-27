import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

/** Password hashing. argon2id with library defaults (64 MiB, t=3, p=4), above OWASP's minimum. */
@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // A malformed stored hash can never match.
      return false;
    }
  }
}
