import { IsNotEmpty, IsString } from "class-validator";

export class EmailVerificationDTO {
  @IsNotEmpty()
  @IsString()
  readonly token: string;
}
