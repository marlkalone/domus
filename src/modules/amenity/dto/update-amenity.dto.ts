import { PartialType } from "@nestjs/mapped-types";
import { IsNotEmpty, IsNumber } from "class-validator";
import { CreateAmenityDTO } from "./create-amenity.dto";

export class UpdateAmenityDTO extends PartialType(CreateAmenityDTO) {
  @IsNumber()
  id: number;

  @IsNotEmpty()
  @IsNumber()
  projectId: number;

  @IsNumber()
  version: number;
}
