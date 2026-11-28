import { randomUUID } from "node:crypto";

import {
  type ChangePasswordValues,
  type CreateAvatarUploadValues,
  type DeleteAccountValues,
  type NotificationPreferences,
  pageMeta,
  type PaginationQuery,
  REGIONAL_FORMAT,
  type SessionInfo,
  ThemePreference,
  type UpdatePreferencesValues,
  type UpdateProfileValues,
  type UploadSlot,
  type UserPreferences,
  type UserProfile,
} from "@automate/shared";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import { pageArgs, Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import type { User, UserPreference } from "@/generated/prisma/client";
import { PasswordService } from "@/modules/auth/password.service";
import { UsersService } from "@/modules/users/users.service";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";
import { SIGNATURE_BYTES, sniffType } from "@/storage/file-signature";
import { STORAGE_PROVIDER, type StorageProvider } from "@/storage/storage.provider";

import { deviceName } from "./device";

const UPLOAD_SECONDS = 10 * 60;
const fieldError = (field: string, message: string) => ({ message, details: [{ field, message }] });
const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  enabled: true,
  documents: true,
  maintenance: true,
  payments: true,
  trips: true,
  fuel: true,
  monthlySummary: false,
};

/**
 * Settings & personalisation (M11, docs/architecture/settings.md): the profile and its photo,
 * preferences that follow the user across devices, reminder switches (read by Notifications), the
 * password, signed-in devices and deleting the account.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly vehicles: VehiclesService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /** A new email is checked with the current password and must be free. */
  async updateProfile(userId: string, values: UpdateProfileValues): Promise<UserProfile> {
    const user = await this.user(userId);
    if (values.email && values.email !== user.email) {
      await this.checkPassword(user, values.currentPassword!, "currentPassword");
      if (await this.users.findByEmail(values.email)) {
        throw new ConflictException(
          fieldError("email", "An account with this email already exists"),
        );
      }
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { name: values.name, email: values.email },
    });
    this.logger.log(`Profile of user ${userId} updated`);
    return this.users.profile(updated);
  }

  /** A slot for a new photo, straight to storage; confirmed before it replaces the old one. */
  async createAvatarUpload(userId: string, values: CreateAvatarUploadValues): Promise<UploadSlot> {
    const key = `users/${userId}/${randomUUID()}`;
    const { url, headers } = await this.storage.createUploadUrl({
      key,
      contentType: values.contentType,
      maxBytes: values.size,
      expiresInSeconds: UPLOAD_SECONDS,
    });
    // The key is the upload's id: confirming checks it's under this user's prefix.
    return {
      fileId: key.split("/")[2]!,
      url,
      headers,
      expiresAt: new Date(Date.now() + UPLOAD_SECONDS * 1000).toISOString(),
    };
  }

  /** The upload arrived and is a photo: it becomes the profile photo and the old one goes. */
  async confirmAvatar(userId: string, fileId: string): Promise<UserProfile> {
    const key = `users/${userId}/${fileId}`;
    const size = await this.storage.size(key);
    if (size === null) {
      throw new BadRequestException(
        fieldError("file", "The photo didn't arrive. Upload it again."),
      );
    }
    const type = sniffType(await this.storage.head(key, SIGNATURE_BYTES));
    if (
      !type ||
      !["image/jpeg", "image/png", "image/webp"].includes(type) ||
      size > 5 * 1024 * 1024
    ) {
      await this.forget([key]);
      throw new BadRequestException(
        fieldError("file", "Use a JPEG, PNG or WebP photo of 5 MB or less."),
      );
    }
    const before = await this.user(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: key },
    });
    if (before.avatarKey && before.avatarKey !== key) await this.forget([before.avatarKey]);
    return this.users.profile(updated);
  }

  async removeAvatar(userId: string): Promise<UserProfile> {
    const before = await this.user(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: null },
    });
    if (before.avatarKey) await this.forget([before.avatarKey]);
    return this.users.profile(updated);
  }

  /** The user's preferences (the defaults until they change one). */
  async preferences(userId: string): Promise<UserPreferences> {
    return toPreferences(await this.prisma.userPreference.findUnique({ where: { userId } }));
  }

  async updatePreferences(
    userId: string,
    values: UpdatePreferencesValues,
  ): Promise<UserPreferences> {
    if (values.defaultVehicleId) await this.vehicles.findOwned(userId, values.defaultVehicleId);
    const notifications = values.notifications ?? {};
    const data = {
      theme: values.theme,
      defaultVehicleId: values.defaultVehicleId,
      notifyEnabled: notifications.enabled,
      notifyDocuments: notifications.documents,
      notifyMaintenance: notifications.maintenance,
      notifyPayments: notifications.payments,
      notifyTrips: notifications.trips,
      notifyFuel: notifications.fuel,
      notifyMonthlySummary: notifications.monthlySummary,
      ...(values.quietHours !== undefined && {
        quietStart: values.quietHours?.start ?? null,
        quietEnd: values.quietHours?.end ?? null,
      }),
    };
    const row = await this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return toPreferences(row);
  }

  /** A new password signs every other device out (this one stays signed in). */
  async changePassword(
    userId: string,
    sessionId: string,
    values: ChangePasswordValues,
  ): Promise<void> {
    const user = await this.user(userId);
    await this.checkPassword(user, values.currentPassword, "currentPassword");
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await this.passwords.hash(values.newPassword) },
      }),
      this.prisma.session.deleteMany({ where: { userId, id: { not: sessionId } } }),
    ]);
    this.logger.log(`Password of user ${userId} changed; other sessions signed out`);
  }

  async sessions(
    userId: string,
    sessionId: string,
    query: PaginationQuery,
  ): Promise<Paginated<SessionInfo>> {
    const where = { userId, expiresAt: { gt: new Date() } };
    const [rows, total] = await Promise.all([
      this.prisma.session.findMany({
        where,
        orderBy: [{ lastUsedAt: "desc" }, { id: "asc" }],
        ...pageArgs(query),
      }),
      this.prisma.session.count({ where }),
    ]);
    return new Paginated(
      rows.map((row) => ({
        id: row.id,
        device: deviceName(row.userAgent),
        createdAt: row.createdAt.toISOString(),
        lastUsedAt: row.lastUsedAt.toISOString(),
        persistent: row.persistent,
        current: row.id === sessionId,
      })),
      pageMeta(query, total),
    );
  }

  async revokeSession(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.session.deleteMany({ where: { id, userId } });
    if (!count) throw new NotFoundException("Session not found");
  }

  async revokeOtherSessions(userId: string, sessionId: string): Promise<number> {
    const { count } = await this.prisma.session.deleteMany({
      where: { userId, id: { not: sessionId } },
    });
    return count;
  }

  /**
   * Deletes the account and everything in it (the database cascades), then its files in storage.
   * Files that fail to delete are logged; the account is gone either way.
   */
  async deleteAccount(userId: string, values: DeleteAccountValues): Promise<void> {
    const user = await this.user(userId);
    await this.checkPassword(user, values.password, "password");
    const files = await this.prisma.documentFile.findMany({
      where: { userId },
      select: { key: true },
    });
    await this.prisma.user.delete({ where: { id: userId } });
    await this.forget([
      ...files.map((file) => file.key),
      ...(user.avatarKey ? [user.avatarKey] : []),
    ]);
    this.logger.log(`Account ${userId} deleted`);
  }

  private async user(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException("Your session has expired. Please sign in again.");
    return user;
  }

  private async checkPassword(user: User, password: string, field: string) {
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      throw new BadRequestException(fieldError(field, "That password isn't right"));
    }
  }

  private async forget(keys: string[]) {
    for (const key of keys) {
      try {
        await this.storage.delete(key);
      } catch (error) {
        this.logger.warn(`Couldn't delete stored file ${key}: ${String(error)}`);
      }
    }
  }
}

function toPreferences(row: UserPreference | null): UserPreferences {
  return {
    theme: row?.theme ?? ThemePreference.DARK,
    defaultVehicleId: row?.defaultVehicleId ?? null,
    notifications: row
      ? {
          enabled: row.notifyEnabled,
          documents: row.notifyDocuments,
          maintenance: row.notifyMaintenance,
          payments: row.notifyPayments,
          trips: row.notifyTrips,
          fuel: row.notifyFuel,
          monthlySummary: row.notifyMonthlySummary,
        }
      : DEFAULT_NOTIFICATIONS,
    regional: REGIONAL_FORMAT,
    quietHours:
      row?.quietStart && row.quietEnd ? { start: row.quietStart, end: row.quietEnd } : null,
  };
}
