import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaxController } from "./tax.controller";
import { TaxService } from "./tax.service";
import { Tax } from "../../infra/database/entities/tax.entity";
import { TaxRepository } from "./repository/tax.repository";
import { TransactionModule } from "../transaction/transaction.module";
import { DatabaseModule } from "../../infra/database/database.module";
import { PlanGuardModule } from "../../common/guards/plan-guard.module";
import { LogModule } from "../log/log.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Tax]),
    forwardRef(() => TransactionModule),
    DatabaseModule,
    PlanGuardModule,
    LogModule,
  ],
  controllers: [TaxController],
  providers: [TaxService, TaxRepository],
  exports: [TaxService],
})
export class TaxModule {}
