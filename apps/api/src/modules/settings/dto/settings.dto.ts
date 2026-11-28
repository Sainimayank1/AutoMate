import {
  changePasswordSchema,
  createAvatarUploadSchema,
  deleteAccountSchema,
  paginationQuerySchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
export class CreateAvatarUploadDto extends createZodDto(createAvatarUploadSchema) {}
export class UpdatePreferencesDto extends createZodDto(updatePreferencesSchema) {}
export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
export class DeleteAccountDto extends createZodDto(deleteAccountSchema) {}
export class SessionListQueryDto extends createZodDto(paginationQuerySchema) {}
