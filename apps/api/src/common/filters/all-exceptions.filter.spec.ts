import { ErrorCode } from "@automate/shared";
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { ZodValidationException } from "nestjs-zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { toErrorShape } from "./all-exceptions.filter";

describe("toErrorShape", () => {
  it("turns Zod validation failures into field errors", () => {
    const result = z.object({ odometer: z.number().positive() }).safeParse({ odometer: -5 });
    if (result.success) throw new Error("expected failure");

    const shape = toErrorShape(new ZodValidationException(result.error));

    expect(shape).toMatchObject({ status: 400, code: ErrorCode.VALIDATION_ERROR });
    expect(shape.details).toEqual([{ field: "odometer", message: expect.any(String) as string }]);
  });

  it("keeps safe 4xx messages and maps status to a code", () => {
    expect(toErrorShape(new NotFoundException("Vehicle not found"))).toEqual({
      status: 404,
      code: ErrorCode.NOT_FOUND,
      message: "Vehicle not found",
      details: [],
    });
  });

  it("passes structured details through", () => {
    const shape = toErrorShape(new BadRequestException({ message: "Bad", details: ["x"] }));
    expect(shape).toMatchObject({ code: ErrorCode.BAD_REQUEST, message: "Bad", details: ["x"] });
  });

  it("never exposes 5xx messages", () => {
    const shape = toErrorShape(new InternalServerErrorException("db password is hunter2"));
    expect(shape).toMatchObject({ status: 500, code: ErrorCode.INTERNAL_ERROR });
    expect(shape.message).not.toContain("hunter2");
  });

  it("keeps deliberate 503 messages (health)", () => {
    const shape = toErrorShape(
      new ServiceUnavailableException({ message: "A required dependency is unavailable" }),
    );
    expect(shape).toMatchObject({ status: 503, code: ErrorCode.SERVICE_UNAVAILABLE });
  });

  it("maps body-parser client errors like 413", () => {
    const error = Object.assign(new Error("request entity too large"), {
      status: 413,
      expose: true,
    });
    expect(toErrorShape(error)).toMatchObject({ status: 413, code: ErrorCode.PAYLOAD_TOO_LARGE });
  });

  it("maps known Prisma errors and hides unknown ones", () => {
    const duplicate = new PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "7",
    });
    const other = new PrismaClientKnownRequestError("Something internal", {
      code: "P1001",
      clientVersion: "7",
    });
    expect(toErrorShape(duplicate)).toMatchObject({ status: 409, code: ErrorCode.CONFLICT });
    expect(toErrorShape(other)).toMatchObject({ status: 500, code: ErrorCode.INTERNAL_ERROR });
  });

  it("hides unknown errors", () => {
    expect(toErrorShape(new Error("secret internals"))).toEqual({
      status: 500,
      code: ErrorCode.INTERNAL_ERROR,
      message: "Internal server error",
      details: [],
    });
  });
});
