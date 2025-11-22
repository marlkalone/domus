import { TaskTodayDTO } from "../../task/dto/tasks-today.dto";
import { ProjectStatus } from "../../../common/enums/project.enum";
import { TransactionHistoryEntryDTO } from "../../transaction/dto/transaction-history.dto";
import { UpcomingExpenseDTO } from "../../transaction/dto/upcoming-expense.dto";
import { PortfolioSummaryDTO } from "../../transaction/dto/dashboard-rentability.dto";

export class ProjectDashboardDTO {
  totalProjects: number;

  projectsByStatus: Record<ProjectStatus, number>;

  totalCostsByStatus: {
    planning: number;
    renovation: number;
    listed: number;
  };

  tasksToday: {
    total: number;
    items: TaskTodayDTO[];
  };

  transactions: {
    historyLast12Months: TransactionHistoryEntryDTO[];
    upcomingOpenExpenses: UpcomingExpenseDTO[];
  };

  portfolioSummary: PortfolioSummaryDTO;
}
