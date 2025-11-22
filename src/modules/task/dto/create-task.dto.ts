import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { TaskStatus } from "../../../common/enums/task.enum";
import { Type } from "class-transformer";
import { AttachmentKeyDTO } from "../../../common/utils/attachment-key.dto";

export class CreateTaskDTO {
  @IsNotEmpty()
  @IsInt()
  projectId: number;

  @IsNotEmpty()
  @IsInt()
  contactId: number;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsISO8601()
  deadline: string;

  @IsOptional()
  @IsString()
  scheduleTime?: string;

  @IsNotEmpty()
  @IsEnum(TaskStatus)
  status: TaskStatus;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttachmentKeyDTO)
  attachmentKeys?: AttachmentKeyDTO[];
}
