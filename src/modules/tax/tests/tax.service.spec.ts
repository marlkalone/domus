import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { TaxService } from "../tax.service";
import { User } from "../../../infra/database/entities/user.entity";
import { Tax } from "../../../infra/database/entities/tax.entity";
import { TaxType } from "../../../common/enums/tax.enum";
import { TransactionManagerService } from "../../../infra/database/transaction-manager.service";
import { LogService } from "../../log/log.service";
import { TaxRepository } from "../repository/tax.repository";
import { CreateTaxDTO } from "../dto/create-tax.dto";
import { TaxFilterDTO } from "../dto/tax-filter.dto";
import { PaginationResponse } from "../../../common/utils/pagination-response";
import { UpdateTaxDTO } from "../dto/update-tax.dto";
import { DeleteTaxDTO } from "../dto/delete-tax.dto";
import { Transaction } from "../../../infra/database/entities/transaction.entity";

let mockRelationBuilder: any;
let mockQueryBuilder: any;

const mockEntityManager = {
  getRepository: jest.fn(() => ({
    createQueryBuilder: () => mockQueryBuilder,
    findOne: jest.fn(),
  })),
};

describe("TaxService", () => {
  let service: TaxService;
  let mockTaxRepo: any;
  let mockTxManager: any;
  let mockLogService: any;

  const mockUser: User = { id: 1 } as User;
  const mockTax: Tax = {
    id: 1,
    title: "Test Tax",
    taxType: TaxType.TAX,
    percentage: 10,
    version: 0,
    startDate: new Date(),
    user: mockUser,
    transactions: [],
  } as Tax;

  beforeEach(async () => {
    mockTaxRepo = {
      createEntity: jest.fn(),
      saveWithManager: jest.fn(),
      findOneByIdAndUser: jest.fn(),
      findAll: jest.fn(),
      findOneByIdAndUserWithManager: jest.fn(),
      removeWithManager: jest.fn(),
      findOneByIdWithManager: jest.fn(),
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

    mockRelationBuilder = {
      add: jest.fn(),
      remove: jest.fn(),
    };
    mockQueryBuilder = {
      relation: jest.fn(() => ({
        of: jest.fn(() => mockRelationBuilder),
      })),
    };

    mockEntityManager.getRepository.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxService,
        { provide: TaxRepository, useValue: mockTaxRepo },
        { provide: TransactionManagerService, useValue: mockTxManager },
        { provide: LogService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<TaxService>(TaxService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create a new tax", async () => {
      const createDto: CreateTaxDTO = {
        title: "New Tax",
        type: TaxType.COMMISSION,
        percentage: 5,
      };
      const createdTax = { ...mockTax, ...createDto };

      mockTaxRepo.createEntity.mockReturnValue(createdTax);
      mockTaxRepo.saveWithManager.mockResolvedValue(createdTax);

      const result = await service.create(1, createDto);

      expect(result).toEqual(createdTax);
      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockTaxRepo.createEntity).toHaveBeenCalledWith(
        expect.objectContaining({ title: "New Tax", user: { id: 1 } }),
      );
      expect(mockTaxRepo.saveWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        createdTax,
      );
      expect(mockLogService.logCreate).toHaveBeenCalledWith(
        mockEntityManager,
        1,
        "Tax",
        createdTax,
      );
    });
  });

  describe("findOne", () => {
    it("should return a tax if found", async () => {
      mockTaxRepo.findOneByIdAndUser.mockResolvedValue(mockTax);

      const result = await service.findOne(1, 1);

      expect(result).toEqual(mockTax);
      expect(mockTaxRepo.findOneByIdAndUser).toHaveBeenCalledWith(1, 1);
    });

    it("should throw NotFoundException if tax not found", async () => {
      mockTaxRepo.findOneByIdAndUser.mockResolvedValue(null);

      await expect(service.findOne(1, 99)).rejects.toThrow(NotFoundException);
    });
  });

  describe("findAll", () => {
    it("should return paginated taxes", async () => {
      const filter: TaxFilterDTO = { skip: 0, limit: 10 };
      const responseData: [Tax[], number] = [[mockTax], 1];
      mockTaxRepo.findAll.mockResolvedValue(responseData);

      const result = await service.findAll(1, filter);

      const expectedResponse: PaginationResponse<Tax> = {
        data: [mockTax],
        total: 1,
        page: 1,
        limit: 10,
      };

      expect(result).toEqual(expectedResponse);
      expect(mockTaxRepo.findAll).toHaveBeenCalledWith(1, filter);
    });
  });

  describe("update", () => {
    const updateDto: UpdateTaxDTO = {
      id: 1,
      version: 0,
      title: "Updated Tax",
      type: TaxType.BROKERAGE,
      percentage: 15,
    };

    it("should update a tax successfully", async () => {
      mockTaxRepo.findOneByIdAndUserWithManager.mockResolvedValue(mockTax);
      mockTaxRepo.saveWithManager.mockResolvedValue({
        ...mockTax,
        ...updateDto,
        version: 1,
      });

      const result = await service.update(1, updateDto);

      expect(result.version).toBe(1);
      expect(result.title).toBe("Updated Tax");
      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockTaxRepo.findOneByIdAndUserWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        1,
        1,
      );
      expect(mockLogService.logUpdate).toHaveBeenCalled();
      expect(mockTaxRepo.saveWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        expect.objectContaining({ title: "Updated Tax", version: 1 }),
      );
    });

    it("should throw NotFoundException if tax not found", async () => {
      mockTaxRepo.findOneByIdAndUserWithManager.mockResolvedValue(null);

      await expect(service.update(1, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw ConflictException on version mismatch", async () => {
      const mismatchedTax = { ...mockTax, version: 1 };
      mockTaxRepo.findOneByIdAndUserWithManager.mockResolvedValue(
        mismatchedTax,
      );

      await expect(service.update(1, updateDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("remove", () => {
    const removeDto: DeleteTaxDTO = { id: 1, user_id: 1 };

    it("should remove a tax and detach from transactions", async () => {
      const mockTaxWithTx = {
        ...mockTax,
        transactions: [{ id: 101 }, { id: 102 }] as Transaction[],
      };

      mockTaxRepo.findOneByIdAndUserWithManager.mockResolvedValue(
        mockTaxWithTx,
      );
      mockTaxRepo.findOneByIdWithManager.mockResolvedValue(mockTaxWithTx);

      await service.remove(removeDto);

      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockLogService.logDelete).toHaveBeenCalled();

      // Verifica se o detachFromAll foi chamado e funcionou
      expect(mockTaxRepo.findOneByIdWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        mockTax.id,
        ["transactions"],
      );
      expect(mockEntityManager.getRepository).toHaveBeenCalledWith(Tax);
      expect(mockQueryBuilder.relation).toHaveBeenCalledWith(
        Tax,
        "transactions",
      );
      expect(mockRelationBuilder.remove).toHaveBeenCalledWith([101, 102]);

      // Verifica se o remove principal foi chamado
      expect(mockTaxRepo.removeWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        mockTaxWithTx,
      );
    });
  });

  describe("attachToTransactionWithManager", () => {
    it("should attach taxes to a transaction", async () => {
      mockTaxRepo.findOneByIdWithManager.mockResolvedValue(mockTax); // Validação

      await service.attachToTransactionWithManager(
        mockEntityManager as unknown as EntityManager,
        100,
        [1, 2],
      );

      expect(mockTaxRepo.findOneByIdWithManager).toHaveBeenCalledTimes(2);

      expect(mockEntityManager.getRepository).toHaveBeenCalledWith(Transaction);
      expect(mockQueryBuilder.relation).toHaveBeenCalledWith(
        Transaction,
        "taxes",
      );
      expect(mockRelationBuilder.add).toHaveBeenCalledWith([1, 2]);
    });

    it("should throw NotFoundException if a tax ID is invalid", async () => {
      mockTaxRepo.findOneByIdWithManager.mockResolvedValue(null); // Validação falha

      await expect(
        service.attachToTransactionWithManager(
          mockEntityManager as unknown as EntityManager,
          100,
          [99],
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("detachFromTransactionWithManager", () => {
    it("should detach all taxes from a transaction", async () => {
      const mockTxWithTaxes = {
        id: 100,
        taxes: [{ id: 1 }, { id: 2 }] as Tax[],
      };

      const txRepoMock = {
        ...mockEntityManager.getRepository(),
        findOne: jest.fn().mockResolvedValue(mockTxWithTaxes),
      };
      mockEntityManager.getRepository.mockReturnValue(txRepoMock);

      await service.detachFromTransactionWithManager(
        mockEntityManager as unknown as EntityManager,
        100,
      );

      expect(txRepoMock.findOne).toHaveBeenCalledWith({
        where: { id: 100 },
        relations: ["taxes"],
      });
      expect(mockQueryBuilder.relation).toHaveBeenCalledWith(
        Transaction,
        "taxes",
      );
      expect(mockRelationBuilder.remove).toHaveBeenCalledWith([1, 2]);
    });
  });

  describe("detachOneWithManager", () => {
    it("should detach one tax from a transaction", async () => {
      await service.detachOneWithManager(
        mockEntityManager as unknown as EntityManager,
        100,
        1,
      );

      expect(mockEntityManager.getRepository).toHaveBeenCalledWith(Transaction);
      expect(mockQueryBuilder.relation).toHaveBeenCalledWith(
        Transaction,
        "taxes",
      );
      expect(mockRelationBuilder.remove).toHaveBeenCalledWith([1]);
    });
  });
});
