import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
} from "class-validator";
import { Type } from "class-transformer";
import { UserType } from "../../../common/enums/user.enum";

export class CreateAdminDTO {
  @IsNotEmpty()
  @IsString()
  readonly name: string;

  @IsNotEmpty()
  @IsEmail({}, { message: "Enter correct email" })
  readonly email: string;

  @IsString()
  @IsStrongPassword()
  readonly password: string;

  @IsOptional()
  @IsString()
  readonly phone?: string;

  @IsNotEmpty()
  @IsEnum(Type)
  readonly type: UserType;

  @IsNotEmpty()
  @IsString()
  readonly document: string;
}
