import { IsNotEmpty, IsNumber } from "class-validator";

export class AssignTaxDTO {
  @IsNotEmpty()
  @IsNumber()
  transactionId: number;
}
