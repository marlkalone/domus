import {
  IsNotEmpty,
  IsEmail,
  IsNumber,
  IsString,
  IsEnum,
  IsOptional,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ContactDetailDTO } from "./contact-detail.dto";
import { ContactRole, ContactType } from "../../../common/enums/contact.enums";
import { AttachmentKeyDTO } from "../../../common/utils/attachment-key.dto";

export class CreateContactDTO {
  @IsNotEmpty()
  @IsEnum(ContactRole)
  role: ContactRole;

  @IsOptional()
  @IsEnum(ContactType)
  contactType?: ContactType;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail({}, { message: "Enter a valid email" })
  email?: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ContactDetailDTO)
  details?: ContactDetailDTO[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttachmentKeyDTO)
  attachmentKeys?: AttachmentKeyDTO[];
}
