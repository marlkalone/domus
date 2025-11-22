import { IsEmail, IsEnum, IsOptional, IsString } from "class-validator";
import { PaginationQueryDTO } from "../../../common/utils/pagination-query.dto";
import { Role } from "../../../common/enums/user.enum";

export class UserFilterDTO extends PaginationQueryDTO {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
