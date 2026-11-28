import { Module } from "@nestjs/common";

import { GeocodingController } from "./geocoding.controller";
import { GeocodingService } from "./geocoding.service";
import { RoutingService } from "./routing.service";

@Module({
  controllers: [GeocodingController],
  providers: [GeocodingService, RoutingService],
  exports: [GeocodingService, RoutingService],
})
export class GeocodingModule {}
