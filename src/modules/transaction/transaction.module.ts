import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TransactionController } from "./transaction.controller";
import { TransactionService } from "./transaction.service";
import { PeriodValidator } from "./helpers/period-validator";
import { RevenueConflictChecker } from "./helpers/revenue-conflict-checker";
import { ProjectModule } from "../project/project.module";
import { ContactModule } from "../contact/contact.module";
import { AttachmentModule } from "../attachment/attachment.module";
import { TaxModule } from "../tax/tax.module";
import { Transaction } from "../../infra/database/entities/transaction.entity";
import { TransactionRepository } from "./repository/transaction.repository";
import { RecurrenceSplitter } from "./helpers/recurrence-spliter";
import { DatabaseModule } from "../../infra/database/database.module";
import { PlanGuardModule } from "../../common/guards/plan-guard.module";
import { LogModule } from "../log/log.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    forwardRef(() => ProjectModule),
    ContactModule,
    AttachmentModule,
    forwardRef(() => TaxModule),
    DatabaseModule,
    PlanGuardModule,
    LogModule,
  ],
  controllers: [TransactionController],
  providers: [
    TransactionService,
    TransactionRepository,
    PeriodValidator,
    RevenueConflictChecker,
    RecurrenceSplitter,
  ],
  exports: [TransactionService],
})
export class TransactionModule {}
