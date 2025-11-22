import { IsEnum, IsOptional, IsString } from "class-validator";
import { ProjectStatus } from "../../../common/enums/project.enum";
import { PaginationQueryDTO } from "../../../common/utils/pagination-query.dto";

export class ProjectFilterDTO extends PaginationQueryDTO {
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsString()
  title?: string;
}
