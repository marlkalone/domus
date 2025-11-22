import { IsNumber } from "class-validator";

export class RentabilityDTO {
  @IsNumber()
  userId: number;

  @IsNumber()
  propertyId: number;

  @IsNumber()
  contactId: number;
}
