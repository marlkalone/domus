import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AppExceptionFilter } from "./errors.filter";

@Module({
  providers: [{ provide: APP_FILTER, useClass: AppExceptionFilter }],
})
export class ErrorsModule {}
