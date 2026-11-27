import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";

/** A `YYYY-MM-DD` route parameter (a calendar date), kept as the string. */
@Injectable()
export class IsoDatePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const valid =
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      new Date(`${value}T00:00:00.000Z`).toISOString().startsWith(value);
    if (!valid) throw new BadRequestException("Use a date like 2026-11-27");
    return value;
  }
}
