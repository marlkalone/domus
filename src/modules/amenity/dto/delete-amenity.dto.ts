import { IsNumber } from "class-validator";

export class DeleteAmenityDTO {
  @IsNumber()
  userId: number;

  @IsNumber()
  projectId: number;

  @IsNumber()
  amenityId: number;
}
