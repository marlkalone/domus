import { ApiProperty } from "@nestjs/swagger";
import { UpcomingExpenseDTO } from "../../transaction/dto/upcoming-expense.dto";
import { InventoryStatsDTO } from "./inventory-stats.dto";
import { TaskTodayDTO } from "../../task/dto/tasks-today.dto";

export class DashboardResponseDTO {
  @ApiProperty()
  totalInvested: number;

  @ApiProperty()
  totalSold: number;

  @ApiProperty()
  totalRevenue: number;

  @ApiProperty()
  totalExpenses: number;

  @ApiProperty()
  netProfit: number;

  @ApiProperty()
  roi: number;

  @ApiProperty()
  projectsInProgress: number;

  @ApiProperty()
  projectsSold: number;

  @ApiProperty({ type: () => TaskTodayDTO })
  tasksToday: TaskTodayDTO;

  @ApiProperty({ type: [UpcomingExpenseDTO] })
  upcomingExpenses: UpcomingExpenseDTO[];

  @ApiProperty({ type: () => InventoryStatsDTO })
  inventoryStats: InventoryStatsDTO;
}
