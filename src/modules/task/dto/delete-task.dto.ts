import { IsNumber } from "class-validator";

export class DeleteTaskDTO {
  @IsNumber()
  userId: number;

  @IsNumber()
  projectId: number;

  @IsNumber()
  id: number;
}
