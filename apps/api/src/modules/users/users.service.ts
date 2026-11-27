import type { UserProfile } from "@automate/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/database/prisma.service";
import type { User } from "@/generated/prisma/client";

/** The only public shape of a user. Never return a `User` row directly: it holds the password hash. */
export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Owns the `users` table. Other modules go through this service, not Prisma. */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
