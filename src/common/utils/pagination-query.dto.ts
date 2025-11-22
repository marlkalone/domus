import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class PaginationQueryDTO {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly skip: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit: number = 10;
}
