import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional } from "class-validator";
import { Type } from "class-transformer";

export class FinancialSummaryQueryDTO {
  @ApiPropertyOptional({
    description: "Ano específico para filtrar o sumário",
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  year?: number;
}
