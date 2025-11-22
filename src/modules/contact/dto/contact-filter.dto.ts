import { IsOptional, IsEnum, IsString } from "class-validator";
import { ContactRole, ContactType } from "../../../common/enums/contact.enums";
import { PaginationQueryDTO } from "../../../common/utils/pagination-query.dto";

export class ContactFilterDTO extends PaginationQueryDTO {
  @IsOptional()
  @IsEnum(ContactType)
  contactType?: ContactType;

  @IsOptional()
  @IsEnum(ContactRole)
  role?: ContactRole;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  name?: string;
}
