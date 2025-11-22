import { IsEnum, IsInt, IsOptional, Min } from "class-validator";
import { TaskStatus } from "../../../common/enums/task.enum";
import { ContactRole } from "../../../common/enums/contact.enums";
import { PaginationQueryDTO } from "../../../common/utils/pagination-query.dto";
import { Type } from "class-transformer";

export type TaskPeriod = "day" | "week" | "month";

export class TaskFilterDTO extends PaginationQueryDTO {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  projectId?: number;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(ContactRole)
  contactRole?: ContactRole;

  @IsOptional()
  @IsEnum(["day", "week", "month"] as const)
  period?: TaskPeriod;
}
