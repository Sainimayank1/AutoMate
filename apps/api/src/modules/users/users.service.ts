import type { UserProfile } from "@automate/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "@/database/prisma.service";
import type { User } from "@/generated/prisma/client";
import { STORAGE_PROVIDER, type StorageProvider } from "@/storage/storage.provider";

/** A profile photo link lasts an hour (the app re-reads the profile on each visit). */
const AVATAR_LINK_SECONDS = 60 * 60;

/** The only public shape of a user. Never return a `User` row directly: it holds the password hash. */
export function toUserProfile(user: User, avatarUrl: string | null = null): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Owns the `users` table. Other modules go through this service, not Prisma. */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /** The profile with a short-lived link to the photo (none when storage can't sign one). */
  async profile(user: User): Promise<UserProfile> {
    if (!user.avatarKey) return toUserProfile(user);
    try {
      return toUserProfile(
        user,
        await this.storage.createDownloadUrl(user.avatarKey, AVATAR_LINK_SECONDS, "profile-photo"),
      );
    } catch (error) {
      this.logger.warn(`No photo link for user ${user.id}: ${String(error)}`);
      return toUserProfile(user);
    }
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** `email` must already be normalised (trimmed, lower-cased) by the shared schema. */
  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /** Registration requires accepting the terms, so acceptance is recorded at creation. */
  create(data: { name: string; email: string; passwordHash: string }): Promise<User> {
    return this.prisma.user.create({ data: { ...data, termsAcceptedAt: new Date() } });
  }
}
