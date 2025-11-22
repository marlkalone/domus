import { IsNotEmpty, IsNumber, IsOptional } from "class-validator";

export class DeleteTaxDTO {
  @IsNotEmpty()
  @IsNumber()
  readonly user_id: number;

  @IsNotEmpty()
  @IsNumber()
  readonly id: number;
}
