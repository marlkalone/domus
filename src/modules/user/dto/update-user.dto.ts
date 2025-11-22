import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { UserType } from "../../../common/enums/user.enum";
import { AttachmentKeyDTO } from "../../../common/utils/attachment-key.dto";
import { RegisterDTO } from "../../auth/dto/register.dto";
import { Type } from "class-transformer";
import { PartialType } from "@nestjs/mapped-types";

export class UpdateUserDTO extends PartialType(RegisterDTO) {
  @IsNotEmpty()
  @IsEnum(UserType)
  readonly type: UserType.COMPANY | UserType.INDIVIDUAL;

  @IsNotEmpty()
  @IsString()
  readonly document: string;

  @IsNotEmpty()
  @IsNumber()
  readonly version: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttachmentKeyDTO)
  attachmentKeys?: AttachmentKeyDTO[];
}
