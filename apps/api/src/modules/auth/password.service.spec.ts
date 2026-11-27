import { describe, expect, it } from "vitest";

import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  const passwords = new PasswordService();

  it("hashes with argon2id and never stores the plain text", async () => {
    const hash = await passwords.hash("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain("correct horse");
  });

  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await passwords.hash("s3cret-pass");
    await expect(passwords.verify(hash, "s3cret-pass")).resolves.toBe(true);
    await expect(passwords.verify(hash, "S3cret-pass")).resolves.toBe(false);
  });

  it("treats a malformed hash as a mismatch", async () => {
    await expect(passwords.verify("not-a-hash", "anything")).resolves.toBe(false);
  });
});
