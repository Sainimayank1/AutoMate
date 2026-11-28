import type {
  ChangePasswordValues,
  CreateAvatarUploadValues,
  DeleteAccountValues,
  PaginationQuery,
  SessionInfo,
  UpdatePreferencesValues,
  UpdateProfileValues,
  UploadSlot,
  UserPreferences,
  UserProfile,
} from "@automate/shared";

import { request, requestPage } from "@/lib/api-client";
import { shrinkImage } from "@/utils/image";

/** Settings (M11): profile, photo, preferences, password, devices, the account. */
export const settingsService = {
  updateProfile: (values: UpdateProfileValues) =>
    request<UserProfile>({ method: "PATCH", url: "/users/me", data: values }),
  /** Announce, PUT straight to storage, confirm: the new profile. */
  async uploadAvatar(original: File): Promise<UserProfile> {
    const file = await shrinkImage(original);
    const announced: CreateAvatarUploadValues = {
      contentType: file.type as CreateAvatarUploadValues["contentType"],
      size: file.size,
    };
    const slot = await request<UploadSlot>({
      method: "POST",
      url: "/users/me/avatar/uploads",
      data: announced,
    });
    const put = await fetch(slot.url, { method: "PUT", headers: slot.headers, body: file });
    if (!put.ok) throw new Error("The photo didn't upload. Try again.");
    return request<UserProfile>({
      method: "POST",
      url: `/users/me/avatar/uploads/${slot.fileId}/confirm`,
    });
  },
  removeAvatar: () => request<UserProfile>({ method: "DELETE", url: "/users/me/avatar" }),
  preferences: () => request<UserPreferences>({ url: "/users/me/preferences" }),
  updatePreferences: (values: UpdatePreferencesValues) =>
    request<UserPreferences>({ method: "PATCH", url: "/users/me/preferences", data: values }),
  changePassword: (values: ChangePasswordValues) =>
    request<void>({ method: "POST", url: "/auth/password", data: values }),
  sessions: (params: Partial<PaginationQuery>) =>
    requestPage<SessionInfo>({ url: "/auth/sessions", params }),
  revokeSession: (id: string) => request<void>({ method: "DELETE", url: `/auth/sessions/${id}` }),
  revokeOthers: () =>
    request<{ signedOut: number }>({ method: "POST", url: "/auth/sessions/revoke-others" }),
  deleteAccount: (values: DeleteAccountValues) =>
    request<void>({ method: "POST", url: "/users/me/delete", data: values }),
};
