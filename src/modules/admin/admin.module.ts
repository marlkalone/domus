import { Module, forwardRef } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { UserModule } from "../user/user.module";
import { SubscriptionModule } from "../subscription/subscription.module";
import { ProjectModule } from "../project/project.module";
import { AttachmentModule } from "../attachment/attachment.module";
import { DatabaseModule } from "../../infra/database/database.module";

@Module({
  imports: [
    forwardRef(() => UserModule),
    SubscriptionModule,
    ProjectModule,
    AttachmentModule,
    DatabaseModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
