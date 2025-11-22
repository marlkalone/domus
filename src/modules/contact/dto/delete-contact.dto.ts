import { IsNotEmpty, IsNumber } from "class-validator";

export class DeleteContactDTO {
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @IsNotEmpty()
  @IsNumber()
  user_id: number;
}
