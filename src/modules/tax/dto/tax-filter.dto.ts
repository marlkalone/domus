import { PaginationQueryDTO } from "../../../common/utils/pagination-query.dto";
import { TaxType } from "../../../common/enums/tax.enum";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class TaxFilterDTO extends PaginationQueryDTO {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(TaxType)
  type?: TaxType;
}
