import { Module } from "@nestjs/common";
import { ProjectModule } from "../project/project.module";
import { TransactionModule } from "../transaction/transaction.module";
import { TaskModule } from "../task/task.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { AmenityModule } from "../amenity/amenity.module";

@Module({
  imports: [ProjectModule, TransactionModule, TaskModule, AmenityModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
