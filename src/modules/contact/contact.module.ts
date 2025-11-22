import { Module } from "@nestjs/common";
import { ContactService } from "./contact.service";
import { ContactController } from "./contact.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Contact } from "../../infra/database/entities/contact.entity";
import { ContactDetail } from "../../infra/database/entities/contactDetail.entity";
import { AttachmentModule } from "../attachment/attachment.module";
import { ContactRepository } from "./repository/contact.repository";
import { ContactDetailRepository } from "./repository/contact-detail.repository";
import { DatabaseModule } from "../../infra/database/database.module";
import { PlanGuardModule } from "../../common/guards/plan-guard.module";
import { LogModule } from "../log/log.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact, ContactDetail]),
    AttachmentModule,
    DatabaseModule,
    PlanGuardModule,
    LogModule,
  ],
  controllers: [ContactController],
  providers: [ContactService, ContactRepository, ContactDetailRepository],
  exports: [ContactService],
})
export class ContactModule {}
