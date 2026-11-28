import {
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  PayloadTooLargeException,
  Put,
  Req,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";

import type { Env } from "@/config/env.validation";
import { Public } from "@/modules/auth/decorators/public.decorator";

import { SIGNATURE_BYTES, sniffType } from "./file-signature";
import { LocalStorageProvider } from "./local-storage.provider";
import { STORAGE_PROVIDER, type StorageProvider } from "./storage.provider";

/**
 * What a bucket's presigned links do, for the local provider only: PUT the file's bytes, GET them
 * back. The signed token is the permission (no login: the browser calls these directly, as it
 * would a bucket). 404 with any other provider.
 */
@ApiExcludeController()
@Public()
@Controller("storage/local")
export class LocalStorageController {
  /** The web app may show the file (an iframe or img on its own origin), as it can a bucket's. */
  private readonly frameAncestors: string;

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    config: ConfigService<Env, true>,
  ) {
    this.frameAncestors = config.get("FRONTEND_URL", { infer: true }).join(" ");
  }

  @Put(":token")
  async upload(@Param("token") token: string, @Req() req: Request, @Res() res: Response) {
    const grant = this.local().verify(token, "put");
    if (!grant) throw new ForbiddenException("This upload link has expired or isn't valid.");
    if (req.headers["content-type"] !== grant.t) {
      throw new ForbiddenException("Upload the file with the type it was announced as.");
    }
    // Refused before reading when the length says so; capped while streaming when it lies.
    if (Number(req.headers["content-length"] ?? 0) > grant.m!) {
      throw new PayloadTooLargeException("The file is bigger than announced.");
    }
    if (!(await this.local().write(grant.k, req, grant.m!))) {
      throw new PayloadTooLargeException("The file is bigger than announced.");
    }
    res.status(HttpStatus.OK).end();
  }

  @Get(":token")
  async download(@Param("token") token: string, @Res() res: Response) {
    const local = this.local();
    const grant = local.verify(token, "get");
    if (!grant) throw new ForbiddenException("This link has expired or isn't valid.");
    if ((await local.size(grant.k)) === null) throw new NotFoundException("File not found");
    const type = sniffType(await local.head(grant.k, SIGNATURE_BYTES));
    res.setHeader("content-type", type ?? "application/octet-stream");
    res.setHeader(
      "content-disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(grant.n ?? "document")}`,
    );
    res.setHeader("x-content-type-options", "nosniff");
    // helmet's defaults forbid framing and cross-origin loads; a bucket's links allow both.
    res.removeHeader("x-frame-options");
    res.setHeader("content-security-policy", `frame-ancestors ${this.frameAncestors}`);
    res.setHeader("cross-origin-resource-policy", "cross-origin");
    local.read(grant.k).pipe(res);
  }

  private local(): LocalStorageProvider {
    if (!(this.storage instanceof LocalStorageProvider)) throw new NotFoundException();
    return this.storage;
  }
}
