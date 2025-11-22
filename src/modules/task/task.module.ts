import { forwardRef, Module } from "@nestjs/common";
import { TaskController } from "./task.controller";
import { TaskService } from "./task.service";
import { TaskRepository } from "./repository/task.repository";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Task } from "../../infra/database/entities/task.entity";
import { ProjectModule } from "../project/project.module";
import { ContactModule } from "../contact/contact.module";
import { AttachmentModule } from "../attachment/attachment.module";
import { DatabaseModule } from "../../infra/database/database.module";
import { PlanGuardModule } from "../../common/guards/plan-guard.module";
import { LogModule } from "../log/log.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    forwardRef(() => ProjectModule),
    forwardRef(() => ContactModule),
    AttachmentModule,
    DatabaseModule,
    PlanGuardModule,
    LogModule,
  ],
  controllers: [TaskController],
  providers: [TaskService, TaskRepository],
  exports: [TaskService],
})
export class TaskModule {}
