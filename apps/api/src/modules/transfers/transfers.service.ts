import {
  addDays,
  type CreateTransferValues,
  istToday,
  pageMeta,
  TRANSFER_EXPIRY_DAYS,
  type TransferListQuery,
  type VehicleTransfer,
} from "@automate/shared";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { pageArgs, Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import { type Prisma, TransferStatus } from "@/generated/prisma/client";
import { BackupService } from "@/modules/backup/backup.service";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

type TransferRow = Prisma.VehicleTransferGetPayload<{
  include: { fromUser: { select: { name: true; email: true } } };
}>;

const GONE = "This transfer is no longer open.";
const fieldError = (field: string, message: string) => ({ message, details: [{ field, message }] });

/**
 * Direct vehicle transfer between accounts (docs/architecture/backup.md §transfer): the owner
 * offers a vehicle to an email address; the account with that email accepts or declines within
 * TRANSFER_EXPIRY_DAYS. Accepting moves the vehicle and everything recorded against it
 * (BackupService.moveVehicle). The sender never learns whether the email has an account.
 */
@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly backup: BackupService,
  ) {}

  async create(
    userId: string,
    { vehicleId, email }: CreateTransferValues,
  ): Promise<VehicleTransfer> {
    const vehicle = await this.vehicles.findOwned(userId, vehicleId);
    const sender = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const toEmail = email.toLowerCase();
    if (toEmail === sender.email.toLowerCase()) {
      throw new BadRequestException(fieldError("email", "That's your own account"));
    }
    const open = await this.prisma.vehicleTransfer.findFirst({
      where: { vehicleId, status: TransferStatus.PENDING, expiresAt: { gt: new Date() } },
    });
    if (open) {
      throw new ConflictException("This vehicle already has a transfer waiting. Cancel it first.");
    }
    const row = await this.prisma.vehicleTransfer.create({
      data: {
        fromUserId: userId,
        vehicleId,
        vehicleName: [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" "),
        registrationNumber: vehicle.registrationNumber,
        toEmail,
        // The end of the last day in India.
        expiresAt: new Date(
          `${addDays(istToday(new Date()), TRANSFER_EXPIRY_DAYS)}T23:59:59.999+05:30`,
        ),
      },
      include: { fromUser: { select: { name: true, email: true } } },
    });
    this.logger.log(`Transfer ${row.id} offered`);
    return this.present(row, "outgoing");
  }

  async list(userId: string, { direction, ...page }: TransferListQuery) {
    const where: Prisma.VehicleTransferWhereInput =
      direction === "outgoing"
        ? { fromUserId: userId }
        : {
            toEmail: await this.emailOf(userId),
            OR: [{ status: TransferStatus.PENDING }, { toUserId: userId }],
          };
    const [rows, total] = await Promise.all([
      this.prisma.vehicleTransfer.findMany({
        where,
        include: { fromUser: { select: { name: true, email: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...pageArgs(page),
      }),
      this.prisma.vehicleTransfer.count({ where }),
    ]);
    return new Paginated(
      rows.map((row) => this.present(row, direction)),
      pageMeta(page, total),
    );
  }

  /** The recipient takes the vehicle. */
  async accept(userId: string, id: string): Promise<VehicleTransfer> {
    const row = await this.incoming(userId, id);
    // Claimed first, so two accepts can't both move it.
    const claimed = await this.prisma.vehicleTransfer.updateMany({
      where: { id, status: TransferStatus.PENDING },
      data: { status: TransferStatus.ACCEPTED, toUserId: userId, decidedAt: new Date() },
    });
    if (!claimed.count || !row.vehicleId) throw new ConflictException(GONE);
    let vehicleId: string;
    try {
      vehicleId = await this.backup.moveVehicle(row.fromUserId, userId, row.vehicleId);
    } catch (error) {
      await this.prisma.vehicleTransfer.update({
        where: { id },
        data: { status: TransferStatus.PENDING, toUserId: null, decidedAt: null },
      });
      throw error;
    }
    this.logger.log(`Transfer ${id} accepted`);
    return this.present(
      await this.prisma.vehicleTransfer.update({
        where: { id },
        data: { vehicleId },
        include: { fromUser: { select: { name: true, email: true } } },
      }),
      "incoming",
    );
  }

  async decline(userId: string, id: string): Promise<VehicleTransfer> {
    await this.incoming(userId, id);
    return this.close(id, TransferStatus.DECLINED, "incoming", { toUserId: userId });
  }

  async cancel(userId: string, id: string): Promise<VehicleTransfer> {
    const row = await this.prisma.vehicleTransfer.findFirst({ where: { id, fromUserId: userId } });
    if (!row) throw new NotFoundException("Transfer not found");
    return this.close(id, TransferStatus.CANCELLED, "outgoing");
  }

  /** An open transfer to this user's email (404 for anyone else's, as for any record). */
  private async incoming(userId: string, id: string) {
    const row = await this.prisma.vehicleTransfer.findFirst({
      where: { id, toEmail: await this.emailOf(userId) },
    });
    if (!row) throw new NotFoundException("Transfer not found");
    if (row.status !== TransferStatus.PENDING || row.expiresAt <= new Date()) {
      throw new ConflictException(GONE);
    }
    return row;
  }

  private async close(
    id: string,
    status: TransferStatus,
    direction: VehicleTransfer["direction"],
    extra: Prisma.VehicleTransferUpdateManyMutationInput = {},
  ) {
    const closed = await this.prisma.vehicleTransfer.updateMany({
      where: { id, status: TransferStatus.PENDING },
      data: { status, decidedAt: new Date(), ...extra },
    });
    if (!closed.count) throw new ConflictException(GONE);
    return this.present(
      await this.prisma.vehicleTransfer.findUniqueOrThrow({
        where: { id },
        include: { fromUser: { select: { name: true, email: true } } },
      }),
      direction,
    );
  }

  private async emailOf(userId: string) {
    return (
      await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    ).email.toLowerCase();
  }

  private present(row: TransferRow, direction: VehicleTransfer["direction"]): VehicleTransfer {
    const expired = row.status === TransferStatus.PENDING && row.expiresAt <= new Date();
    return {
      id: row.id,
      direction,
      vehicleName: row.vehicleName,
      registrationNumber: row.registrationNumber,
      otherParty:
        direction === "incoming"
          ? { name: row.fromUser.name, email: row.fromUser.email }
          : { name: null, email: row.toEmail },
      status: expired ? "EXPIRED" : row.status,
      expiresAt: row.expiresAt.toISOString(),
      decidedAt: row.decidedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      vehicleId:
        direction === "incoming" && row.status === TransferStatus.ACCEPTED ? row.vehicleId : null,
    };
  }
}
