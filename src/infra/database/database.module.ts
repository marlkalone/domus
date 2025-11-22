import { InternalServerErrorException, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TransactionManagerService } from "./transaction-manager.service";
import { TypeOrmModule, TypeOrmModuleOptions } from "@nestjs/typeorm";

const TypeOrmDatabaseModule = TypeOrmModule.forRootAsync({
  useFactory: (config: ConfigService): TypeOrmModuleOptions => {
    const dbConfig = config.get<TypeOrmModuleOptions>("database");

    if (!dbConfig) {
      throw new InternalServerErrorException(
        "Database configuration not found or missing.",
      );
    }
    return dbConfig;
  },
  inject: [ConfigService],
});

@Module({
  imports: [TypeOrmDatabaseModule],
  providers: [TransactionManagerService],
  exports: [TypeOrmDatabaseModule, TransactionManagerService],
})
export class DatabaseModule {}
