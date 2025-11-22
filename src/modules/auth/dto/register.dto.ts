import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  ValidateNested,
} from "class-validator";
import { UserType } from "../../../common/enums/user.enum";
import { AttachmentKeyDTO } from "../../../common/utils/attachment-key.dto";
import { UserAddressDTO } from "../../user/dto/user-address.dto";
import { Type } from "class-transformer";

export class RegisterDTO {
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
  @IsEnum(UserType)
  readonly type: UserType.COMPANY | UserType.INDIVIDUAL;

  @IsNotEmpty()
  @IsString()
  readonly document: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => UserAddressDTO)
  readonly address: UserAddressDTO;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttachmentKeyDTO)
  attachmentKeys?: AttachmentKeyDTO[];
}
