import { Global, Module } from "@nestjs/common";
import { PermissionCacheService } from "./permission-cache.service";
import { DatabaseModule } from "../../infra/database/database.module";
import { Plan } from "../../infra/database/entities/plan.entity";
import { TypeOrmModule } from "@nestjs/typeorm";

@Global()
@Module({
  imports: [DatabaseModule, TypeOrmModule.forFeature([Plan])],
  providers: [PermissionCacheService],
  exports: [PermissionCacheService],
})
export class PermissionCacheModule {}
