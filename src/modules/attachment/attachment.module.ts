import { Module } from "@nestjs/common";
import { AttachmentService } from "./attachment.service";
import { MulterModule } from "@nestjs/platform-express";
import { MulterConfigService } from "./multer.config";
import { AttachmentController } from "./attachment.controller";
import { AttachmentRepository } from "./repository/attachment.repository";
import { Attachment } from "../../infra/database/entities/attachment.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseModule } from "../../infra/database/database.module";
import { PlanGuardModule } from "../../common/guards/plan-guard.module";
import { StorageModule } from "../../infra/storage/storage.module";
import { QueueModule } from "../../infra/queue/queue.module";

@Module({
  imports: [
    StorageModule,
    QueueModule,
    MulterModule.registerAsync({
      useClass: MulterConfigService,
    }),
    TypeOrmModule.forFeature([Attachment]),
    DatabaseModule,
    PlanGuardModule,
  ],
  providers: [AttachmentService, MulterConfigService, AttachmentRepository],
  controllers: [AttachmentController],
  exports: [AttachmentService],
})
export class AttachmentModule {}
