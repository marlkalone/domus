import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
} from "class-validator";

export class CreateSaleTransactionDTO {
  @IsNotEmpty()
  @IsNumber()
  projectId: number;

  @IsNotEmpty()
  @IsNumber()
  contactId: number;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  salePrice: number;

  @IsNotEmpty()
  @IsDateString()
  saleDate: string;
}
