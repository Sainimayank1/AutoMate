import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";
import { describe, expect, it } from "vitest";

import { ResponseEnvelopeInterceptor } from "../interceptors/response-envelope.interceptor";
import { pageArgs, Paginated } from "./paginated";

describe("Paginated", () => {
  const letters = ["a", "b", "c", "d", "e"];

  it("slices a page and counts the pages", () => {
    expect(Paginated.of(letters, { page: 2, pageSize: 2 })).toEqual({
      items: ["c", "d"],
      meta: { page: 2, pageSize: 2, total: 5, totalPages: 3 },
    });
    expect(Paginated.of(letters, { page: 9, pageSize: 2 }).items).toEqual([]);
    expect(Paginated.of([], { page: 1, pageSize: 20 }).meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
    expect(pageArgs({ page: 3, pageSize: 20 })).toEqual({ skip: 40, take: 20 });
  });

  it("becomes data + meta in the envelope", async () => {
    const context = {
      switchToHttp: () => ({ getResponse: () => ({ statusCode: 200 }) }),
    } as unknown as ExecutionContext;
    const handler: CallHandler = {
      handle: () => of(Paginated.of(letters, { page: 1, pageSize: 2 })),
    };

    await expect(
      lastValueFrom(new ResponseEnvelopeInterceptor().intercept(context, handler)),
    ).resolves.toMatchObject({
      success: true,
      data: ["a", "b"],
      meta: { page: 1, pageSize: 2, total: 5, totalPages: 3 },
    });
  });
});
