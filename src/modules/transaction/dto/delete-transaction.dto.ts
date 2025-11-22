import { IsEnum, IsInt, IsNumber, IsOptional } from "class-validator";
import { Type } from "class-transformer";
import { UpdateScope } from "./update-scope.enum";

export class DeleteTransactionDTO {
  @IsNumber()
  userId: number;

  @IsInt()
  @Type(() => Number)
  projectId: number;

  @IsInt()
  @Type(() => Number)
  id: number;

  @IsEnum(UpdateScope)
  @IsOptional()
  scope: UpdateScope = UpdateScope.ONE;
}
