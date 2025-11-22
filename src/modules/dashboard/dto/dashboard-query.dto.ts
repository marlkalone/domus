import { IsNumber, IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { RentabilityFilter } from "../../../common/enums/transaction.enum";
import { Type } from "class-transformer";

export class DashboardQueryDTO {
  @ApiPropertyOptional({
    description: "Filtro de período para rentabilidade",
    enum: ["weekly", "monthly", "trimestral", "semestral", "annual"],
  })
  @IsString()
  @IsOptional()
  filter: RentabilityFilter = "annual";

  @ApiPropertyOptional({
    description: "Ano específico para filtrar os dados",
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  year?: number;
}
