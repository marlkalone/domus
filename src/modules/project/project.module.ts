import { Module } from "@nestjs/common";
import { ProjectController } from "./project.controller";
import { ProjectService } from "./project.service";
import { AttachmentModule } from "../attachment/attachment.module";
import { ProjectRepository } from "./repository/project.repository";
import { DatabaseModule } from "../../infra/database/database.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Project } from "../../infra/database/entities/project.entity";
import { ProjectAddress } from "../../infra/database/entities/projectAddress.entity";
import { ProjectDetail } from "../../infra/database/entities/projectDetail.entity";
import { PlanGuardModule } from "../../common/guards/plan-guard.module";
import { LogModule } from "../log/log.module";

@Module({
  imports: [
    AttachmentModule,
    DatabaseModule,
    PlanGuardModule,
    TypeOrmModule.forFeature([Project, ProjectAddress, ProjectDetail]),
    LogModule,
  ],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectRepository],
  exports: [ProjectService],
})
export class ProjectModule {}
