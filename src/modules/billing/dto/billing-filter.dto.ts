import { IsEnum, IsInt, IsOptional } from "class-validator";
import { Type } from "class-transformer";
import { BillingStatus } from "../../../common/enums/billing.enum";
import { PaginationQueryDTO } from "../../../common/utils/pagination-query.dto";

export class BillingFilterDTO extends PaginationQueryDTO {
  @IsInt()
  @Type(() => Number)
  projectId: number;

  @IsOptional()
  @IsEnum(BillingStatus)
  status?: BillingStatus;
}
