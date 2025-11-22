import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { ApiOperation } from "@nestjs/swagger";
import { UserId } from "../../common/decorators/user-id.decorator";
import { DashboardQueryDTO } from "./dto/dashboard-query.dto";
import { TaskCentralDTO } from "../task/dto/task-central.dto";
import { ProjectDashboardDTO } from "../project/dto/project-dashboard.dto";
import { FinancialSummaryQueryDTO } from "./dto/financial-summary-query.dto";
import { PortfolioSummaryDTO } from "../transaction/dto/dashboard-rentability.dto";
import { TaskFilterDTO } from "../task/dto/task-filter.dto";
import { ProjectDetailDTO } from "../project/dto/project-detail.dto";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: "Get main aggregated dashboard data" })
  async getDashboard(
    @UserId() userId: number,
    @Query() query: DashboardQueryDTO,
  ): Promise<ProjectDashboardDTO> {
    return this.dashboardService.getDashboardData(userId, query.year);
  }

  @Get("financial-summary")
  @ApiOperation({ summary: "Get a summary of financial rentability" })
  async getFinancialSummary(
    @UserId() userId: number,
    @Query() query: FinancialSummaryQueryDTO,
  ): Promise<PortfolioSummaryDTO> {
    return this.dashboardService.getFinancialSummary(userId, query.year);
  }

  @Get("task-central")
  @ApiOperation({
    summary: "Get tasks grouped by status for a task central view",
  })
  async getTaskCentral(
    @UserId() userId: number,
    @Query() filter: TaskFilterDTO,
  ): Promise<TaskCentralDTO> {
    return this.dashboardService.getTaskCentral(userId, filter);
  }

  @Get("project-detail/:id")
  @ApiOperation({ summary: "Get aggregated detail data for a single project" })
  async getProjectDetail(
    @UserId() userId: number,
    @Param("id", ParseIntPipe) projectId: number,
  ): Promise<ProjectDetailDTO> {
    return this.dashboardService.getProjectDetail(userId, projectId);
  }
}
