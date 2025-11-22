import { PartialType } from "@nestjs/mapped-types";
import { CreateBillingDTO } from "./create-billing.dto";
import { IsNumber, IsNotEmpty } from "class-validator";

export class UpdateBillingDTO extends PartialType(CreateBillingDTO) {
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @IsNumber()
  @IsNotEmpty()
  readonly version: number;
}
