import { ApiProperty } from "@nestjs/swagger";

export class TaskTodayDTO {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ description: "Horário da tarefa, ex: 14:30" })
  time: string;
}
