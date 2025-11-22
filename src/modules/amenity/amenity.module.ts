import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AmenityController } from "./amenity.controller";
import { AmenityService } from "./amenity.service";
import { ProjectModule } from "../project/project.module";
import { AttachmentModule } from "../attachment/attachment.module";
import { DatabaseModule } from "../../infra/database/database.module";
import { PlanGuardModule } from "../../common/guards/plan-guard.module";
import { LogModule } from "../log/log.module";
import { Amenity } from "../../infra/database/entities/amenity.entity";
import { AmenityRepository } from "./repository/amenity.repository";

@Module({
  imports: [
    TypeOrmModule.forFeature([Amenity]),
    forwardRef(() => ProjectModule),
    AttachmentModule,
    DatabaseModule,
    PlanGuardModule,
    LogModule,
  ],
  controllers: [AmenityController],
  providers: [AmenityService, AmenityRepository],
  exports: [AmenityService],
})
export class AmenityModule {}
