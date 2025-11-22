import { IsNotEmpty, IsNumber } from "class-validator";

export class ReadTaskDTO {
  @IsNotEmpty()
  @IsNumber()
  projectId: number;

  @IsNotEmpty()
  @IsNumber()
  taskId: number;
}
