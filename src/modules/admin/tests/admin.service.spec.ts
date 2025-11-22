import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { EntityManager } from "typeorm";
import * as bcrypt from "bcrypt";
import { format } from "date-fns";
import { AdminService } from "../admin.service";
import { Plan } from "../../../infra/database/entities/plan.entity";
import { User } from "../../../infra/database/entities/user.entity";
import { Subscription } from "../../../infra/database/entities/subscription.entity";
import { Role, UserType } from "../../../common/enums/user.enum";
import { SubscriptionStatus } from "../../../common/enums/subscription.enum";
import { TransactionManagerService } from "../../../infra/database/transaction-manager.service";
import { UserService } from "../../user/user.service";
import { PlanService } from "../../subscription/plan.service";
import { SubscriptionService } from "../../subscription/subscription.service";
import { ProjectService } from "../../project/project.service";
import { PaginationQueryDTO } from "../../../common/utils/pagination-query.dto";
import { ProjectStatus } from "../../../common/enums/project.enum";
import { CreateAdminDTO } from "../dto/create-admin.dto";
import { UserAddress } from "../../../infra/database/entities/userAddress.entity";

jest.mock("bcrypt");

const mockEntityManager = {
  create: jest.fn(),
  save: jest.fn(),
};

describe("AdminService", () => {
  let service: AdminService;
  let mockTxManager: any;
  let mockUserService: any;
  let mockPlanService: any;
  let mockSubscriptionService: any;
  let mockProjectService: any;

  const mockPlan: Plan = { id: 1, name: "PRO" } as any;
  const mockAdminUser: User = { id: 1, name: "Admin", role: Role.ADMIN } as any;
  const mockSubscription: Subscription = {
    id: 1,
    status: SubscriptionStatus.ACTIVE,
  } as any;

  beforeEach(async () => {
    // Limpar e re-mockar implementações do bcrypt
    (bcrypt.hash as jest.Mock).mockClear();
    (bcrypt.hash as jest.Mock).mockResolvedValue("hashed_password");

    // Inicialização dos mocks
    mockTxManager = {
      run: jest.fn().mockImplementation(async (callback) => {
        return await callback(mockEntityManager as unknown as EntityManager);
      }),
    };
    mockUserService = {
      verifyUserExists: jest.fn(),
      getUserStats: jest.fn(),
      deleteUser: jest.fn(),
    };
    mockPlanService = {
      findAll: jest.fn(),
      findByCode: jest.fn(),
    };
    mockSubscriptionService = {
      adminFindAllByStatus: jest.fn(),
      adminGetActiveSubscriptionStats: jest.fn(),
      adminGetMonthlyRevenueByPlan: jest.fn(),
    };
    mockProjectService = {
      adminCountAll: jest.fn(),
      adminCountByStatus: jest.fn(),
    };

    // Limpeza dos mocks do EntityManager
    mockEntityManager.create.mockClear();
    mockEntityManager.save.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: TransactionManagerService, useValue: mockTxManager },
        { provide: UserService, useValue: mockUserService },
        { provide: PlanService, useValue: mockPlanService },
        { provide: SubscriptionService, useValue: mockSubscriptionService },
        { provide: ProjectService, useValue: mockProjectService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getSubscriptionsWithPlans", () => {
    const pagination: PaginationQueryDTO = { skip: 0, limit: 10 };

    it("should return paginated subscriptions and total revenue", async () => {
      mockSubscriptionService.adminFindAllByStatus.mockResolvedValue([
        [mockSubscription],
        1,
      ]);
      mockSubscriptionService.adminGetActiveSubscriptionStats.mockResolvedValue(
        {
          totalRevenue: 100.5,
        },
      );

      const result = await service.getSubscriptionsWithPlans(pagination);

      expect(result.data[0]).toEqual(mockSubscription);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalRevenue).toBe(100.5);
    });

    it("should throw NotFoundException if no active subscriptions", async () => {
      mockSubscriptionService.adminFindAllByStatus.mockResolvedValue([[], 0]);

      await expect(
        service.getSubscriptionsWithPlans(pagination),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getMonthlyRevenueByPlan", () => {
    it("should return revenue buckets correctly filled", async () => {
      // 1. Mocks
      const plans = [{ name: "Plan A" }, { name: "Plan B" }] as Plan[];
      const revenueData = [
        { planName: "Plan A", month: format(new Date(), "MMMM"), revenue: 150 },
      ];

      mockPlanService.findAll.mockResolvedValue(plans);
      mockSubscriptionService.adminGetMonthlyRevenueByPlan.mockResolvedValue(
        revenueData,
      );

      // 2. Execução
      const result = await service.getMonthlyRevenueByPlan();

      expect(result["Plan A"]).toBeDefined();
      expect(result["Plan B"]).toBeDefined();
      expect(result["Plan A"]).toHaveLength(12); // Garante que 12 meses foram criados

      // Encontra o bucket do mês atual para o 'Plan A' e verifica a receita
      const currentMonth = format(new Date(), "MMMM");
      const planABucket = result["Plan A"].find(
        (b) => b.month === currentMonth,
      );
      expect(planABucket?.revenue).toBe(150);

      // Garante que o 'Plan B' (sem dados) tem receita 0 para o mesmo mês
      const planBBucket = result["Plan B"].find(
        (b) => b.month === currentMonth,
      );
      expect(planBBucket?.revenue).toBe(0);
    });
  });

  describe("getProjectStats", () => {
    it("should return aggregated project stats", async () => {
      mockProjectService.adminCountAll.mockResolvedValue(10);
      mockProjectService.adminCountByStatus.mockResolvedValue([
        { status: ProjectStatus.SOLD, total: 3 },
        { status: ProjectStatus.RENOVATION, total: 2 },
      ]);

      const result = await service.getProjectStats();

      expect(result.total).toBe(10);
      expect(result[ProjectStatus.SOLD]).toBe(3);
      expect(result[ProjectStatus.RENOVATION]).toBe(2);
      expect(result[ProjectStatus.PLANNING]).toBe(0); // Garante que o default foi preenchido
    });

    it("should throw NotFoundException if no projects found", async () => {
      mockProjectService.adminCountAll.mockResolvedValue(0);

      await expect(service.getProjectStats()).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getUserStats", () => {
    it("should pass through to userService.getUserStats", async () => {
      const stats = { total: 10, individual: 5, company: 5 };
      mockUserService.getUserStats.mockResolvedValue(stats);

      const result = await service.getUserStats();

      expect(result).toEqual(stats);
      expect(mockUserService.getUserStats).toHaveBeenCalled();
    });
  });

  describe("create", () => {
    const createDto: CreateAdminDTO = {
      name: "New Admin",
      email: "admin@example.com",
      password: "Password123!",
      phone: "123456789",
      document: "12345678900",
      type: UserType.INDIVIDUAL,
    };

    it("should create an admin, address, and subscription in a transaction", async () => {
      mockUserService.verifyUserExists.mockResolvedValue(false);
      mockPlanService.findByCode.mockResolvedValue(mockPlan);
      mockEntityManager.create.mockImplementation((entity, data) => data);
      mockEntityManager.save.mockResolvedValue(mockAdminUser);

      const result = await service.create(createDto);

      expect(result).toEqual(mockAdminUser);
      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockUserService.verifyUserExists).toHaveBeenCalledWith(
        createDto.email,
      );
      expect(mockPlanService.findByCode).toHaveBeenCalledWith("PRO");
      expect(bcrypt.hash).toHaveBeenCalledWith(createDto.password, 10);

      expect(mockEntityManager.create).toHaveBeenCalledWith(
        User,
        expect.objectContaining({ role: Role.ADMIN }),
      );
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        UserAddress,
        expect.any(Object),
      );
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Subscription,
        expect.objectContaining({ status: SubscriptionStatus.ACTIVE }),
      );
      expect(mockEntityManager.save).toHaveBeenCalledTimes(3);
    });

    it("should throw ConflictException if email already exists", async () => {
      mockUserService.verifyUserExists.mockResolvedValue(true);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockTxManager.run).not.toHaveBeenCalled();
    });
  });

  describe("deleteUser", () => {
    it("should pass through to userService.deleteUser", async () => {
      mockUserService.deleteUser.mockResolvedValue();

      await service.deleteUser(5);

      expect(mockUserService.deleteUser).toHaveBeenCalledWith(5);
    });
  });
});
