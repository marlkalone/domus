import { IsInt } from "class-validator";
import { Type } from "class-transformer";

export class DeleteTaxAssociationDto {
  @IsInt()
  @Type(() => Number)
  transactionId: number;

  @IsInt()
  @Type(() => Number)
  taxId: number;
}
