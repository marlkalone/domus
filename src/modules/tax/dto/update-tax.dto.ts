import { PartialType } from "@nestjs/mapped-types";
import { CreateTaxDTO } from "./create-tax.dto";
import { IsNotEmpty, IsNumber, IsOptional } from "class-validator";

export class UpdateTaxDTO extends PartialType(CreateTaxDTO) {
  @IsNumber()
  @IsOptional()
  id: number;

  @IsNotEmpty()
  @IsNumber()
  version: number;
}
