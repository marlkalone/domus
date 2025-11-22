import { IsNotEmpty, IsString } from "class-validator";

export class RefreshTokenDTO {
  @IsNotEmpty()
  @IsString()
  readonly refreshToken: string;
}
