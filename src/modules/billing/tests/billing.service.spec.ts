import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { EntityManager } from "typeorm";
import { BillingService } from "../billing.service";
import { User } from "../../../infra/database/entities/user.entity";
import { Project } from "../../../infra/database/entities/project.entity";
import { Billing } from "../../../infra/database/entities/billing.entity";
import { BillingStatus } from "../../../common/enums/billing.enum";
import { BillingRepository } from "../repository/billing.repository";
import { TransactionService } from "../../transaction/transaction.service";
import { ProjectService } from "../../project/project.service";
import { LogService } from "../../log/log.service";
import { TransactionManagerService } from "../../../infra/database/transaction-manager.service";
import { CreateBillingDTO } from "../dto/create-billing.dto";
import { ReadBillingDTO } from "../dto/read-billing.dto";
import { BillingFilterDTO } from "../dto/billing-filter.dto";
import { UpdateBillingDTO } from "../dto/update-billing.dto";
import { DeleteBillingDTO } from "../dto/delete-billing.dto";

// Mock do Repositório do Manager (para métodos dentro da transação)
const mockManagerRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

// Mock do EntityManager
const mockEntityManager = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  // Retorna o mockRepo específico quando getRepository(Billing) é chamado
  getRepository: jest.fn(() => mockManagerRepo),
};

describe("BillingService", () => {
  let service: BillingService;
  let mockBillingRepo: any;
  let mockTxService: any;
  let mockProjectService: any;
  let mockLogService: any;
  let mockTxManager: any;

  // --- Mocks de Dados ---
  const mockUser: User = { id: 1 } as any;
  const mockProject: Project = { id: 1, user: mockUser } as any;

  // Usamos 'let' para poder resetar o status em 'markAsPaid'
  let mockBilling: Billing;

  beforeEach(async () => {
    // Inicializa o mockBilling limpo para cada teste
    mockBilling = {
      id: 1,
      projectId: 1,
      project: mockProject,
      description: "Test Bill",
      amount: 100,
      billingDate: new Date(),
      status: BillingStatus.PENDING,
      version: 0,
    } as any;

    // Inicialização dos mocks de serviço/repo
    mockBillingRepo = {
      findOneByIds: jest.fn(),
      findAll: jest.fn(),
    };
    mockTxService = {
      create: jest.fn(),
    };
    mockProjectService = {
      findOne: jest.fn(),
    };
    mockLogService = {
      logCreate: jest.fn(),
      logUpdate: jest.fn(),
      logDelete: jest.fn(),
    };
    mockTxManager = {
      run: jest.fn().mockImplementation(async (callback) => {
        return await callback(mockEntityManager as unknown as EntityManager);
      }),
    };

    // Limpeza dos mocks do EntityManager e seu repositório
    mockEntityManager.findOne.mockClear();
    mockEntityManager.create.mockClear();
    mockEntityManager.save.mockClear();
    mockEntityManager.getRepository.mockClear();
    mockManagerRepo.findOne.mockClear();
    mockManagerRepo.save.mockClear();
    mockManagerRepo.remove.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: BillingRepository, useValue: mockBillingRepo },
        { provide: TransactionService, useValue: mockTxService },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: LogService, useValue: mockLogService },
        { provide: TransactionManagerService, useValue: mockTxManager },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    const userId = 1;
    const createDto: CreateBillingDTO = {
      projectId: 1,
      billingDate: new Date().toISOString(),
      amount: 150,
    };

    it("should create a new billing record", async () => {
      mockEntityManager.findOne.mockResolvedValue(mockProject);
      mockEntityManager.create.mockReturnValue(mockBilling);
      mockEntityManager.save.mockResolvedValue(mockBilling);

      const result = await service.create(userId, createDto);

      expect(result).toEqual(mockBilling);
      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockEntityManager.findOne).toHaveBeenCalledWith(Project, {
        where: { id: createDto.projectId, user: { id: userId } },
      });
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Billing,
        expect.any(Object),
      );
      expect(mockEntityManager.save).toHaveBeenCalledWith(mockBilling);
      expect(mockLogService.logCreate).toHaveBeenCalled();
    });

    it("should throw NotFoundException if project not found", async () => {
      mockEntityManager.findOne.mockResolvedValue(null);
      await expect(service.create(userId, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("read", () => {
    const readDto: ReadBillingDTO = { projectId: 1, billingId: 1 };

    it("should return a single billing record", async () => {
      mockBillingRepo.findOneByIds.mockResolvedValue(mockBilling);

      const result = await service.read(1, readDto);

      expect(result).toEqual(mockBilling);
      expect(mockBillingRepo.findOneByIds).toHaveBeenCalledWith(1, 1, 1);
    });

    it("should throw NotFoundException if billing not found", async () => {
      mockBillingRepo.findOneByIds.mockResolvedValue(null);

      await expect(service.read(1, readDto)).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if only projectId is provided", async () => {
      const badDto: ReadBillingDTO = { projectId: 1 }; // Sem billingId

      await expect(service.read(1, badDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("findAll", () => {
    const filter: BillingFilterDTO = { projectId: 1, skip: 0, limit: 10 };

    it("should return paginated billing records", async () => {
      mockProjectService.findOne.mockResolvedValue(mockProject);
      mockBillingRepo.findAll.mockResolvedValue([[mockBilling], 1]);

      const result = await service.findAll(1, filter);

      expect(mockProjectService.findOne).toHaveBeenCalledWith(1, 1);
      expect(mockBillingRepo.findAll).toHaveBeenCalledWith(1, filter);
      expect(result.data[0]).toEqual(mockBilling);
      expect(result.total).toBe(1);
    });

    it("should throw NotFoundException if project not found", async () => {
      mockProjectService.findOne.mockResolvedValue(null);

      await expect(service.findAll(1, filter)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    const updateDto: UpdateBillingDTO = {
      id: 1,
      version: 0,
      amount: 200,
    };

    it("should update a billing record", async () => {
      mockManagerRepo.findOne.mockResolvedValue(mockBilling);
      mockManagerRepo.save.mockResolvedValue({
        ...mockBilling,
        ...updateDto,
        version: 1,
      });

      const result = await service.update(1, updateDto);

      expect(result.amount).toBe(200);
      expect(result.version).toBe(1);
      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockEntityManager.getRepository).toHaveBeenCalledWith(Billing);
      expect(mockManagerRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ["project", "project.user"],
      });
      expect(mockLogService.logUpdate).toHaveBeenCalled();
      expect(mockManagerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 200, version: 1 }),
      );
    });

    it("should throw NotFoundException if user does not own billing", async () => {
      const otherUserBilling = { ...mockBilling, project: { user: { id: 2 } } };
      mockManagerRepo.findOne.mockResolvedValue(otherUserBilling);

      await expect(service.update(1, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw ConflictException on version mismatch", async () => {
      const mismatchedBilling = { ...mockBilling, version: 1 };
      mockManagerRepo.findOne.mockResolvedValue(mismatchedBilling);

      await expect(service.update(1, updateDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("remove", () => {
    const removeDto: DeleteBillingDTO = { id: 1, projectId: 1 };

    it("should remove a billing record", async () => {
      mockManagerRepo.findOne.mockResolvedValue(mockBilling);

      await service.remove(1, removeDto);

      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockEntityManager.getRepository).toHaveBeenCalledWith(Billing);
      expect(mockManagerRepo.findOne).toHaveBeenCalled();
      expect(mockLogService.logDelete).toHaveBeenCalledWith(
        mockEntityManager as unknown as EntityManager,
        1,
        "Billing",
        mockBilling,
      );
      expect(mockManagerRepo.remove).toHaveBeenCalledWith(mockBilling);
    });
  });

  describe("markAsPaid", () => {
    const paymentDate = new Date();
    const userId = 1;
    const billingId = 1;

    it("should mark bill as PAID and create a transaction", async () => {
      mockManagerRepo.findOne.mockResolvedValue(mockBilling); // Status é PENDING
      mockManagerRepo.save.mockResolvedValue(true);
      mockTxService.create.mockResolvedValue({ id: 99 }); // Mock criação de tx

      const result = await service.markAsPaid(userId, billingId, paymentDate);

      expect(result.status).toBe(BillingStatus.PAID);
      expect(result.paymentDate).toEqual(paymentDate);
      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockManagerRepo.findOne).toHaveBeenCalled();

      // Verifica se o bill foi salvo com status PAID
      expect(mockManagerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: BillingStatus.PAID }),
      );

      // Verifica se a transação foi criada
      expect(mockTxService.create).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          category: "FROM_BILLING",
          amount: mockBilling.amount,
          projectId: mockBilling.project.id,
        }),
      );
    });

    it("should throw ConflictException if bill is already paid", async () => {
      mockBilling.status = BillingStatus.PAID;
      mockManagerRepo.findOne.mockResolvedValue(mockBilling);

      await expect(
        service.markAsPaid(userId, billingId, paymentDate),
      ).rejects.toThrow(ConflictException);
      expect(mockManagerRepo.save).not.toHaveBeenCalled();
      expect(mockTxService.create).not.toHaveBeenCalled();
    });
  });
});
