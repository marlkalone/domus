import { Module } from "@nestjs/common";
import { PlanGuard } from "./plan.guard";
import {
  ProjectMaxCountHandler,
  ProjectPhotoLimitHandler,
  ProjectVideoLimitHandler,
  AmenitiesPerProjectHandler,
  ContactMaxCountHandler,
  TaskActiveLimitHandler,
  TxMonthlyLimitHandler,
  TaxEnabledHandler,
  AttachTotalCountHandler,
} from "./permissions/permission.handlers";
import { DatabaseModule } from "../../infra/database/database.module";
import { PermissionCacheModule } from "../../modules/permission-cache/permission-cache.module";

/**
 * Módulo que encapsula o PlanGuard e todos os seus manipuladores de permissão.
 * Importe este módulo onde o PlanGuard for necessário.
 */
@Module({
  imports: [DatabaseModule, PermissionCacheModule],
  providers: [
    PlanGuard,
    ProjectMaxCountHandler,
    ProjectPhotoLimitHandler,
    ProjectVideoLimitHandler,
    AmenitiesPerProjectHandler,
    ContactMaxCountHandler,
    TaskActiveLimitHandler,
    TxMonthlyLimitHandler,
    TaxEnabledHandler,
    AttachTotalCountHandler,
  ],
  exports: [
    PlanGuard,
    ProjectMaxCountHandler,
    ProjectPhotoLimitHandler,
    ProjectVideoLimitHandler,
    AmenitiesPerProjectHandler,
    ContactMaxCountHandler,
    TaskActiveLimitHandler,
    TxMonthlyLimitHandler,
    TaxEnabledHandler,
    AttachTotalCountHandler,
  ],
})
export class PlanGuardModule {}
