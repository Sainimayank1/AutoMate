import { Module } from "@nestjs/common";

import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";

@Module({
  imports: [VehiclesModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  // The dashboard and Notifications read expiring documents.
  exports: [DocumentsService],
})
export class DocumentsModule {}
