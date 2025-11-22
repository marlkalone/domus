import { Test, TestingModule } from "@nestjs/testing";
import { DashboardService } from "../dashboard.service";
import { ProjectService } from "../../project/project.service";
import { TransactionService } from "../../transaction/transaction.service";
import { TaskService } from "../../task/task.service";
import { AmenityService } from "../../amenity/amenity.service";
import { ProjectStatus } from "../../../common/enums/project.enum";
import { TaskFilterDTO } from "../../task/dto/task-filter.dto";
import { Project } from "../../../infra/database/entities/project.entity";

describe("DashboardService", () => {
  let service: DashboardService;
  let mockProjectService: any;
  let mockTransactionService: any;
  let mockTaskService: any;
  let mockAmenityService: any;

  beforeEach(async () => {
    mockProjectService = {
      countByStatusForUser: jest.fn(),
      findOne: jest.fn(),
      countCollaborators: jest.fn(),
    };
    mockTransactionService = {
      sumExpensesByProjectStatus: jest.fn(),
      getDashboardTransactions: jest.fn(),
      getTotalsByYear: jest.fn(),
      getPortfolioSummaryByYear: jest.fn(),
      sumExpensesForProject: jest.fn(),
    };
    mockTaskService = {
      getTodayTasks: jest.fn(),
      getCentralTasksPage: jest.fn(),
      getTodayTasksByProject: jest.fn(),
    };
    mockAmenityService = {
      countTotalItems: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: ProjectService, useValue: mockProjectService },
        { provide: TransactionService, useValue: mockTransactionService },
        { provide: TaskService, useValue: mockTaskService },
        { provide: AmenityService, useValue: mockAmenityService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getDashboardData", () => {
    const userId = 1;
    const year = 2024;

    it("should aggregate data from all services correctly", async () => {
      mockProjectService.countByStatusForUser.mockResolvedValue([
        { status: ProjectStatus.RENOVATION, total: 2 },
        { status: ProjectStatus.SOLD, total: 1 },
      ]);
      mockTransactionService.sumExpensesByProjectStatus.mockResolvedValue([
        { status: ProjectStatus.RENOVATION, total: "150000.00" },
        { status: ProjectStatus.PLANNING, total: "50000.00" },
      ]);
      mockTaskService.getTodayTasks.mockResolvedValue({ total: 1, items: [] });
      mockTransactionService.getDashboardTransactions.mockResolvedValue({
        historyLast12Months: [],
        upcomingOpenExpenses: [],
      });
      mockTransactionService.getTotalsByYear.mockResolvedValue({
        revenue: "500000.00",
        expense: "300000.00",
      });

      const result = await service.getDashboardData(userId, year);

      expect(mockProjectService.countByStatusForUser).toHaveBeenCalledWith(
        userId,
      );
      expect(
        mockTransactionService.sumExpensesByProjectStatus,
      ).toHaveBeenCalledWith(userId);
      expect(mockTaskService.getTodayTasks).toHaveBeenCalledWith(userId);
      expect(
        mockTransactionService.getDashboardTransactions,
      ).toHaveBeenCalledWith(userId);
      expect(mockTransactionService.getTotalsByYear).toHaveBeenCalledWith(
        userId,
        null,
        year,
      );

      // Verifica os cálculos e agregações
      expect(result.totalProjects).toBe(3);
      expect(result.projectsByStatus[ProjectStatus.RENOVATION]).toBe(2);
      expect(result.projectsByStatus[ProjectStatus.LISTED]).toBe(0); // Garante que status vazios são zerados
      expect(result.totalCostsByStatus.planning).toBe(50000.0);
      expect(result.totalCostsByStatus.renovation).toBe(150000.0);
      expect(result.totalCostsByStatus.listed).toBe(0);
      expect(result.tasksToday.total).toBe(1);
      expect(result.portfolioSummary.totalRevenue).toBe(500000.0);
      expect(result.portfolioSummary.totalCosts).toBe(300000.0);
      expect(result.portfolioSummary.netProfit).toBe(200000.0); // 500k - 300k
    });
  });

  describe("getFinancialSummary", () => {
    it("should return financial summary from TransactionService", async () => {
      mockTransactionService.getPortfolioSummaryByYear.mockResolvedValue({
        revenue: "100",
        expense: "50",
        net: "50",
      });

      const result = await service.getFinancialSummary(1, 2024);

      expect(result).toEqual({
        totalRevenue: 100,
        totalCosts: 50,
        netProfit: 50,
      });
      expect(
        mockTransactionService.getPortfolioSummaryByYear,
      ).toHaveBeenCalledWith(1, 2024);
    });
  });

  describe("getTaskCentral", () => {
    it("should delegate to TaskService", async () => {
      const filter: TaskFilterDTO = { skip: 0, limit: 10 };
      const mockResponse = { tasks: [] } as any;
      mockTaskService.getCentralTasksPage.mockResolvedValue(mockResponse);

      const result = await service.getTaskCentral(1, filter);

      expect(result).toEqual(mockResponse);
      expect(mockTaskService.getCentralTasksPage).toHaveBeenCalledWith(
        1,
        filter,
      );
    });
  });

  describe("getProjectDetail", () => {
    const userId = 1;
    const projectId = 1;
    const mockProject = {
      id: 1,
      acquisitionPrice: 200000,
      targetSalePrice: 350000,
      status: ProjectStatus.RENOVATION,
      actualSalePrice: null,
    } as any;

    it("should aggregate project details and calculate profit/ROI", async () => {
      // Mocks das respostas do Promise.all
      mockProjectService.findOne.mockResolvedValue(mockProject);
      mockTaskService.getTodayTasksByProject.mockResolvedValue({
        total: 2,
        items: [],
      });
      mockProjectService.countCollaborators.mockResolvedValue(5);
      mockAmenityService.countTotalItems.mockResolvedValue(10);
      mockTransactionService.sumExpensesForProject.mockResolvedValue(50000); // Custos de renovação

      const result = await service.getProjectDetail(userId, projectId);

      expect(mockProjectService.findOne).toHaveBeenCalledWith(
        userId,
        projectId,
      );
      expect(mockTaskService.getTodayTasksByProject).toHaveBeenCalledWith(
        userId,
        projectId,
      );
      expect(mockProjectService.countCollaborators).toHaveBeenCalledWith(
        projectId,
      );
      expect(mockAmenityService.countTotalItems).toHaveBeenCalledWith(
        userId,
        projectId,
      );
      expect(mockTransactionService.sumExpensesForProject).toHaveBeenCalledWith(
        projectId,
      );

      // Verifica os cálculos
      expect(result.totalCosts).toBe(250000); // 200k (aquisição) + 50k (renovação)
      expect(result.estimatedProfit).toBe(100000); // 350k (meta) - 250k (custo total)
      expect(result.actualProfit).toBeUndefined(); // Não está vendido
      expect(result.roi).toBeUndefined(); // Não está vendido
      expect(result.tasksToday.total).toBe(2);
      expect(result.collaboratorsCount).toBe(5);
      expect(result.inventoryCount).toBe(10);
    });

    it("should calculate actualProfit and ROI for a SOLD project", async () => {
      const mockSoldProject = {
        ...mockProject,
        status: ProjectStatus.SOLD,
        actualSalePrice: 400000,
      };

      mockProjectService.findOne.mockResolvedValue(mockSoldProject as any);
      mockTaskService.getTodayTasksByProject.mockResolvedValue({
        total: 0,
        items: [],
      });
      mockProjectService.countCollaborators.mockResolvedValue(0);
      mockAmenityService.countTotalItems.mockResolvedValue(0);
      mockTransactionService.sumExpensesForProject.mockResolvedValue(50000);

      const result = await service.getProjectDetail(userId, projectId);

      const totalCosts = 250000;
      const actualProfit = 150000;
      const roi = (actualProfit / totalCosts) * 100;

      expect(result.totalCosts).toBe(totalCosts);
      expect(result.actualProfit).toBe(actualProfit);
      expect(result.roi).toBe(roi);
    });
  });
});
