import { ApiProperty } from "@nestjs/swagger";

export class InventoryStatsDTO {
  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  totalValue: number;
}
