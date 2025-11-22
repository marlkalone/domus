import { Module } from "@nestjs/common";
import { LogService } from "./log.service";
import { Log } from "../../infra/database/entities/log.entity";
import { DatabaseModule } from "../../infra/database/database.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LogRepository } from "./repository/log.repository";

@Module({
  imports: [TypeOrmModule.forFeature([Log]), DatabaseModule],
  providers: [LogService, LogRepository],
  exports: [LogService],
})
export class LogModule {}
