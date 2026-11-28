import { Global, Module, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "@/config/env.validation";

import { BucketStorageProvider } from "./bucket-storage.provider";
import { LocalStorageController } from "./local-storage.controller";
import { LocalStorageProvider } from "./local-storage.provider";
import { STORAGE_PROVIDER, type StorageProvider } from "./storage.provider";
import { StorageSweepService } from "./storage-sweep.service";
import { ThumbnailService } from "./thumbnail.service";

/** Production without a bucket: documents work, files don't (env validation allows it). */
const unavailable = () => {
  throw new ServiceUnavailableException("File storage isn't set up yet.");
};
const NO_STORAGE: StorageProvider = {
  createUploadUrl: unavailable,
  createDownloadUrl: unavailable,
  size: unavailable,
  head: unavailable,
  get: unavailable,
  put: unavailable,
  delete: () => Promise.resolve(),
};

/** The configured StorageProvider (STORAGE_PROVIDER), for every module that keeps files. */
@Global()
@Module({
  controllers: [LocalStorageController],
  providers: [
    StorageSweepService,
    ThumbnailService,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): StorageProvider => {
        const provider = config.get("STORAGE_PROVIDER", { infer: true });
        if (provider === "local") {
          const prefix = config.get("API_PREFIX", { infer: true });
          const version = config.get("API_VERSION", { infer: true });
          return new LocalStorageProvider(
            config.get("STORAGE_LOCAL_DIR", { infer: true }),
            `${config.get("STORAGE_PUBLIC_URL", { infer: true })}/${prefix}/${version}/storage/local`,
            config.get("JWT_ACCESS_SECRET", { infer: true }),
          );
        }
        if (provider === "r2" || provider === "s3") {
          return new BucketStorageProvider(
            config.get("STORAGE_ENDPOINT", { infer: true }),
            config.get("STORAGE_BUCKET", { infer: true }),
            {
              accessKeyId: config.get("STORAGE_ACCESS_KEY", { infer: true }),
              secretAccessKey: config.get("STORAGE_SECRET_KEY", { infer: true }),
              region: config.get("STORAGE_REGION", { infer: true }),
            },
          );
        }
        return NO_STORAGE;
      },
    },
  ],
  exports: [STORAGE_PROVIDER, StorageSweepService, ThumbnailService],
})
export class StorageModule {}
