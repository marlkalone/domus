import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { Billing } from "../../infra/database/entities/billing.entity";
import { BillingRepository } from "./repository/billing.repository";
import { PlanGuardModule } from "../../common/guards/plan-guard.module";
import { DatabaseModule } from "../../infra/database/database.module";
import { TransactionModule } from "../transaction/transaction.module";
import { ProjectModule } from "../project/project.module";
import { LogModule } from "../log/log.module";

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([Billing]),
    PlanGuardModule,
    TransactionModule,
    ProjectModule,
    LogModule,
  ],
  controllers: [BillingController],
  providers: [BillingService, BillingRepository],
})
export class BillingModule {}
