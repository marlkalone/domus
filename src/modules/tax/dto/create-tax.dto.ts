import { TaxType } from "../../../common/enums/tax.enum";
import { IsEnum, IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateTaxDTO {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsEnum(TaxType)
  type: TaxType;

  @IsNotEmpty()
  @IsNumber()
  percentage: number;
}
