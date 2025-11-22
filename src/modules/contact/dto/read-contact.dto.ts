import { IsNotEmpty, IsOptional, IsNumber } from "class-validator";

export class ReadContactDTO {
  @IsNotEmpty()
  @IsNumber()
  user_id: number;

  @IsOptional()
  @IsNumber()
  id?: number;
}
