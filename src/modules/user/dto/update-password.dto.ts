import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsStrongPassword,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdatePasswordDto {
  @IsNotEmpty()
  @IsNumber()
  readonly user_id: number;

  @IsNotEmpty()
  @IsString()
  @IsStrongPassword()
  readonly password: string;

  @IsNotEmpty()
  @IsNumber()
  readonly version: number;
}
