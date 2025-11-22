import { ProjectService } from "../project/project.service";
import { TransactionService } from "../transaction/transaction.service";
import { TaskService } from "../task/task.service";
import { TaskFilterDTO } from "../task/dto/task-filter.dto";
import { ProjectStatus } from "../../common/enums/project.enum";
import { Injectable } from "@nestjs/common";
import { TaskCentralDTO } from "../task/dto/task-central.dto";
import { plainToInstance } from "class-transformer";
import { ProjectDashboardDTO } from "../project/dto/project-dashboard.dto";
import { PortfolioSummaryDTO } from "../transaction/dto/dashboard-rentability.dto";
import { AmenityService } from "../amenity/amenity.service";
import { ProjectDetailDTO } from "../project/dto/project-detail.dto";

@Injectable()
export class DashboardService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly transactionService: TransactionService,
    private readonly taskService: TaskService,
    private readonly amenityService: AmenityService,
  ) {}

  async getDashboardData(
    userId: number,
    year?: number,
  ): Promise<ProjectDashboardDTO> {
    const currentYear = year || new Date().getFullYear();

    const [
      countsArr,
      sumByStatusArr,
      tasksToday,
      transactions, // Contém historyLast12Months e upcomingOpenExpenses
      portfolioSummaryRaw,
    ] = await Promise.all([
      this.projectService.countByStatusForUser(userId),
      this.transactionService.sumExpensesByProjectStatus(userId),
      this.taskService.getTodayTasks(userId),
      this.transactionService.getDashboardTransactions(userId),
      this.transactionService.getTotalsByYear(userId, null, currentYear),
    ]);

    // 2. Mapear Contagens de Projetos
    const totalProjects = countsArr.reduce((sum, c) => sum + c.total, 0);
    const projectsByStatus = Object.values(ProjectStatus).reduce(
      (acc, status) => {
        acc[status] = countsArr.find((c) => c.status === status)?.total || 0;
        return acc;
      },
      {} as Record<ProjectStatus, number>,
    );

    // 3. Mapear Custos por Status
    const totalCostsByStatus = Object.values(ProjectStatus).reduce(
      (acc, status) => {
        if (
          [
            ProjectStatus.PLANNING,
            ProjectStatus.RENOVATION,
            ProjectStatus.LISTED,
          ].includes(status)
        ) {
          const sumStr =
            sumByStatusArr.find((s) => s.status === status)?.total || "0";
          acc[status.toLowerCase()] = parseFloat(sumStr);
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    // 4. Mapear Sumário do Portfólio
    const { revenue, expense } = portfolioSummaryRaw;
    const totalRevenue = parseFloat(revenue) || 0;
    const totalCosts = parseFloat(expense) || 0;
    const portfolioSummary = {
      totalRevenue: totalRevenue,
      totalCosts: totalCosts,
      netProfit: totalRevenue - totalCosts,
    };

    return plainToInstance(ProjectDashboardDTO, {
      totalProjects,
      projectsByStatus,
      totalCostsByStatus: {
        planning: totalCostsByStatus.planning || 0,
        renovation: totalCostsByStatus.renovation || 0,
        listed: totalCostsByStatus.listed || 0,
      },
      tasksToday,
      transactions,
      portfolioSummary,
    });
  }

  /**
   * 2. LÓGICA DO SUMÁRIO FINANCEIRO
   */
  async getFinancialSummary(
    userId: number,
    year?: number,
  ): Promise<PortfolioSummaryDTO> {
    const currentYear = year || new Date().getFullYear();
    const { revenue, expense, net } =
      await this.transactionService.getPortfolioSummaryByYear(
        userId,
        currentYear,
      );

    return {
      totalRevenue: parseFloat(revenue) || 0,
      totalCosts: parseFloat(expense) || 0,
      netProfit: parseFloat(net) || 0,
    };
  }

  /**
   * 3. LÓGICA DA CENTRAL DE TAREFAS
   */
  async getTaskCentral(
    userId: number,
    filter: TaskFilterDTO,
  ): Promise<TaskCentralDTO> {
    return this.taskService.getCentralTasksPage(userId, filter);
  }

  async getProjectDetail(
    userId: number,
    projectId: number,
  ): Promise<ProjectDetailDTO> {
    const project = await this.projectService.findOne(userId, projectId);

    const [tasksToday, collaboratorsCount, inventoryCount, renovationCosts] =
      await Promise.all([
        this.taskService.getTodayTasksByProject(userId, projectId),
        this.projectService.countCollaborators(projectId),
        this.amenityService.countTotalItems(userId, projectId),
        this.transactionService.sumExpensesForProject(projectId),
      ]);

    // 3. Calcula os custos
    const totalCosts =
      Number(project.acquisitionPrice) + Number(renovationCosts);

    // 4. Calcula o Lucro/ROI
    const estimatedProfit = Number(project.targetSalePrice) - totalCosts;
    let actualProfit: number | undefined = undefined;
    let roi: number | undefined = undefined;

    if (
      project.status === ProjectStatus.SOLD &&
      typeof project.actualSalePrice === "number" &&
      project.actualSalePrice > 0
    ) {
      actualProfit = Number(project.actualSalePrice) - totalCosts;
      if (totalCosts > 0) {
        roi = (actualProfit / totalCosts) * 100;
      } else if (actualProfit > 0) {
        roi = 100;
      }
    }

    return plainToInstance(ProjectDetailDTO, {
      ...project,
      totalCosts,
      estimatedProfit,
      actualProfit,
      roi,
      tasksToday,
      collaboratorsCount,
      inventoryCount,
    });
  }
}
