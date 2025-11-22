import { IsNotEmpty, IsNumber } from "class-validator";

export class DeleteProjectDTO {
  @IsNotEmpty()
  @IsNumber()
  readonly user_id: number;

  @IsNotEmpty()
  @IsNumber()
  readonly id: number;
}
