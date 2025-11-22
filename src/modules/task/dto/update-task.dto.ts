import { PartialType } from "@nestjs/mapped-types";
import { CreateTaskDTO } from "./create-task.dto";
import { IsInt, IsNotEmpty, IsNumber } from "class-validator";

export class UpdateTaskDTO extends PartialType(CreateTaskDTO) {
  @IsNotEmpty()
  @IsInt()
  projectId: number;

  @IsNotEmpty()
  @IsInt()
  contactId: number;

  @IsNumber()
  version: number;
}
