import { IsNotEmpty, IsNumber } from "class-validator";

export class DeleteUserDTO {
  @IsNotEmpty()
  @IsNumber()
  readonly user_id: number;
}
