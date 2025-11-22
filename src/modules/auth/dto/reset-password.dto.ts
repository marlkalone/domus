import { IsNotEmpty, IsString, MinLength, MaxLength } from "class-validator";

export class ResetPasswordDTO {
  @IsNotEmpty()
  readonly token: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  readonly newPassword: string;
}
