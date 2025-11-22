import { IsNumber, IsOptional } from "class-validator";

export class ReadAmenityDTO {
  @IsNumber()
  projectId: number;

  @IsNumber()
  amenityId: number;
}
