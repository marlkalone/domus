import { IsNotEmpty, IsNumber } from "class-validator";

export class FindByIdDTO {
  @IsNotEmpty()
  @IsNumber()
  user_id: number;
}
