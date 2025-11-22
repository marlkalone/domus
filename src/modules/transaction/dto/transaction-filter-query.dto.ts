import { IsOptional, IsInt, IsEnum } from "class-validator";
import { Type } from "class-transformer";
import { PaginationQueryDTO } from "../../../common/utils/pagination-query.dto";
import {
  PeriodicityType,
  TransactionType,
} from "../../../common/enums/transaction.enum";

export class TransactionFilterQueryDto extends PaginationQueryDTO {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  readonly projectId?: number;

  @IsOptional()
  @IsEnum(TransactionType)
  readonly type?: TransactionType;

  @IsOptional()
  @IsEnum(PeriodicityType)
  readonly recurrence?: PeriodicityType;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  readonly year?: number;
}
