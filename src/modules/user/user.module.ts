import { forwardRef, Module } from "@nestjs/common";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";

import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../../infra/database/entities/user.entity";
import { AttachmentModule } from "../attachment/attachment.module";
import { SubscriptionModule } from "../subscription/subscription.module";
import { UserRepository } from "./repository/user.repository";
import { DatabaseModule } from "../../infra/database/database.module";
import { LogModule } from "../log/log.module";

@Module({
  imports: [
    DatabaseModule,
    AttachmentModule,
    LogModule,
    forwardRef(() => SubscriptionModule),
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService],
})
export class UserModule {}
