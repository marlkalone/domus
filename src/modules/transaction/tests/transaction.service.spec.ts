import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { TransactionService } from "../transaction.service";
import { Project } from "../../../infra/database/entities/project.entity";
import { Contact } from "../../../infra/database/entities/contact.entity";
import { Transaction } from "../../../infra/database/entities/transaction.entity";
import {
  PeriodicityType,
  TransactionStatus,
  TransactionType,
} from "../../../common/enums/transaction.enum";
import { PeriodValidator } from "../helpers/period-validator";
import { TransactionRepository } from "../repository/transaction.repository";
import { AttachmentService } from "../../attachment/attachment.service";
import { TaxService } from "../../tax/tax.service";
import { RecurrenceSplitter } from "../helpers/recurrence-spliter";
import { TransactionManagerService } from "../../../infra/database/transaction-manager.service";
import { ProjectService } from "../../project/project.service";
import { ContactService } from "../../contact/contact.service";
import { LogService } from "../../log/log.service";
import { CreateTransactionDTO } from "../dto/create-transaction.dto";
import { AttachmentOwnerType } from "../../../common/enums/subscription.enum";
import { ProjectStatus } from "../../../common/enums/project.enum";
import { UpdateTransactionDto } from "../dto/update-transaction.dto";
import { UpdateScope } from "../dto/update-scope.enum";
import { DeleteTransactionDTO } from "../dto/delete-transaction.dto";

const mockEntityManager = {
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
};

describe("TransactionService", () => {
  let service: TransactionService;
  let mockTxRepo: any;
  let mockAttachSvc: any;
  let mockTaxSvc: any;
  let mockSplitter: any;
  let mockTxManager: any;
  let mockProjectService: any;
  let mockContactService: any;
  let mockLogService: any;
  let periodValidatorSpy: any;

  const mockProject: Project = { id: 1, title: "Test Project" } as Project;
  const mockContact: Contact = { id: 1, name: "Test Contact" } as Contact;

  const mockTransaction: Transaction = {
    id: 1,
    title: "Test TX",
    category: "Test",
    type: TransactionType.EXPENSE,
    recurrence: PeriodicityType.ONE_TIME,
    paymentDate: new Date(),
    startDate: new Date(),
    amount: 100,
    status: TransactionStatus.TO_INVOICE,
    version: 0,
    project: mockProject,
    contact: mockContact,
    parent: null,
    children: [],
    taxes: [],
    attachments: [],
  } as unknown as Transaction;

  beforeEach(async () => {
    periodValidatorSpy = jest
      .spyOn(PeriodValidator, "validateDates")
      .mockImplementation(() => {});

    mockTxRepo = {
      createWithManager: jest.fn(),
      saveWithManager: jest.fn(),
      deleteWithManager: jest.fn(),
      findOneWithManager: jest.fn(),
      findOne: jest.fn(),
      findFilteredPaginated: jest.fn(),
      getTotalsByYear: jest.fn(),
    };

    mockAttachSvc = {
      createRecordsWithManager: jest.fn(),
      removeAllForOwnerWithManager: jest.fn(),
    };

    mockTaxSvc = {
      attachToTransactionWithManager: jest.fn(),
      detachFromTransactionWithManager: jest.fn(),
    };

    mockSplitter = {
      split: jest.fn(),
    };

    mockProjectService = {
      findOne: jest.fn(),
      saveWithManager: jest.fn(),
    };

    mockContactService = {
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

    mockEntityManager.create.mockClear();
    mockEntityManager.save.mockClear();
    mockEntityManager.remove.mockClear();
    mockEntityManager.findOne.mockClear();
    mockEntityManager.find.mockClear();
    periodValidatorSpy.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: TransactionRepository, useValue: mockTxRepo },
        { provide: AttachmentService, useValue: mockAttachSvc },
        { provide: TaxService, useValue: mockTaxSvc },
        { provide: RecurrenceSplitter, useValue: mockSplitter },
        { provide: TransactionManagerService, useValue: mockTxManager },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: ContactService, useValue: mockContactService },
        { provide: LogService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    const userId = 1;
    const dto: CreateTransactionDTO = {
      projectId: 1,
      contactId: 1,
      title: "New TX",
      category: "New",
      type: TransactionType.EXPENSE,
      status: TransactionStatus.TO_INVOICE,
      recurrence: PeriodicityType.ONE_TIME,
      amount: 100,
      startDate: new Date().toISOString(),
      taxIds: [1],
      attachmentKeys: [
        { key: "key1", originalName: "doc.pdf", mimeType: "app/pdf" },
      ],
    };

    it("should create a single transaction (one-time)", async () => {
      mockProjectService.findOne.mockResolvedValue(mockProject);
      mockContactService.findOne.mockResolvedValue(mockContact);
      mockSplitter.split.mockReturnValue([
        { start: new Date(), end: new Date() },
      ]);
      mockTxRepo.createWithManager.mockResolvedValue(mockTransaction);
      mockTxRepo.findOneWithManager.mockResolvedValue(mockTransaction);

      const result = await service.create(userId, dto);

      expect(result).toEqual(mockTransaction);
      expect(mockProjectService.findOne).toHaveBeenCalledWith(
        userId,
        dto.projectId,
      );
      expect(mockContactService.findOne).toHaveBeenCalledWith(
        userId,
        dto.contactId,
      );
      expect(periodValidatorSpy).toHaveBeenCalled();
      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockSplitter.split).toHaveBeenCalled();
      expect(mockTxRepo.createWithManager).toHaveBeenCalledTimes(1);
      expect(mockTaxSvc.attachToTransactionWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        mockTransaction.id,
        dto.taxIds,
      );
      expect(mockAttachSvc.createRecordsWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        AttachmentOwnerType.TRANSACTION,
        mockTransaction.id,
        dto.attachmentKeys,
      );
      expect(mockLogService.logCreate).toHaveBeenCalled();
    });

    it("should create multiple transactions (recurring)", async () => {
      const recurringDto = { ...dto, recurrence: PeriodicityType.RECURRING };
      const segments = [
        { start: new Date("2023-01-01"), end: new Date("2023-02-01") },
        { start: new Date("2023-02-01"), end: new Date("2023-03-01") },
      ];
      const tx1 = { ...mockTransaction, id: 1, parentId: undefined };
      const tx2 = { ...mockTransaction, id: 2, parentId: 1 };

      mockProjectService.findOne.mockResolvedValue(mockProject);
      mockContactService.findOne.mockResolvedValue(mockContact);
      mockSplitter.split.mockReturnValue(segments);
      // Simula a criação sequencial
      mockTxRepo.createWithManager
        .mockResolvedValueOnce(tx1)
        .mockResolvedValueOnce(tx2);
      mockTxRepo.findOneWithManager.mockResolvedValue(tx1); // Retorna o primeiro

      await service.create(userId, recurringDto);

      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockSplitter.split).toHaveBeenCalled();
      expect(mockTxRepo.createWithManager).toHaveBeenCalledTimes(2);

      // Verifica se o parentId foi definido corretamente
      expect(mockTxRepo.createWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        expect.objectContaining({ parentId: undefined }),
      );
      expect(mockTxRepo.createWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        expect.objectContaining({ parentId: tx1.id }),
      );

      // Verifica se taxas e anexos foram aplicados a AMBOS
      expect(mockTaxSvc.attachToTransactionWithManager).toHaveBeenCalledTimes(
        2,
      );
      expect(mockAttachSvc.createRecordsWithManager).toHaveBeenCalledTimes(2);
    });

    it("should throw NotFoundException if project not found", async () => {
      mockProjectService.findOne.mockResolvedValue(null);

      await expect(service.create(userId, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockContactService.findOne).not.toHaveBeenCalled();
    });
  });

  describe("createSaleTransaction", () => {
    it("should update project status and create a revenue transaction", async () => {
      const saleTx = { ...mockTransaction, type: TransactionType.REVENUE };

      mockProjectService.findOne.mockResolvedValue(mockProject);
      mockContactService.findOne.mockResolvedValue(mockContact);
      mockTxRepo.createWithManager.mockResolvedValue(saleTx);

      const result = await service.createSaleTransaction(
        1,
        1,
        500000,
        1,
        new Date(),
      );

      expect(result).toEqual(saleTx);
      expect(mockTxManager.run).toHaveBeenCalled();
      // Verifica se o projeto foi atualizado e salvo
      expect(mockProjectService.saveWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        expect.objectContaining({
          status: ProjectStatus.SOLD,
          actualSalePrice: 500000,
        }),
      );
      // Verifica se a transação de receita foi criada
      expect(mockTxRepo.createWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        expect.objectContaining({ type: TransactionType.REVENUE }),
      );
    });
  });

  describe("update", () => {
    const dto: UpdateTransactionDto = {
      id: 1,
      userId: 1,
      projectId: 1,
      version: 0,
      title: "Updated TX",
      category: "Updated",
      status: TransactionStatus.INVOICED,
      amount: 150,
      startDate: new Date().toISOString(),
      scope: UpdateScope.ONE,
      taxIds: [2],
      attachmentKeys: [],
    };

    it("should update a single transaction (scope=ONE)", async () => {
      mockTxRepo.findOneWithManager.mockResolvedValue(mockTransaction);
      mockTxRepo.saveWithManager.mockResolvedValue(true);

      await service.update(dto);

      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockTxRepo.findOneWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        dto.userId,
        dto.projectId,
        dto.id,
      );
      expect(mockTxRepo.saveWithManager).toHaveBeenCalledTimes(1);
      expect(mockTxRepo.saveWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        expect.objectContaining({ title: "Updated TX", version: 1 }),
      );

      // Verifica sincronia de taxas
      expect(mockTaxSvc.detachFromTransactionWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        dto.id,
      );
      expect(mockTaxSvc.attachToTransactionWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        dto.id,
        dto.taxIds,
      );

      // Verifica sincronia de anexos
      expect(mockAttachSvc.removeAllForOwnerWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        AttachmentOwnerType.TRANSACTION,
        dto.id,
      );
      expect(mockAttachSvc.createRecordsWithManager).not.toHaveBeenCalled(); // DTO enviou array vazio
    });

    it("should throw ConflictException on version mismatch (scope=ONE)", async () => {
      const mismatchedTx = { ...mockTransaction, version: 1 };
      mockTxRepo.findOneWithManager.mockResolvedValue(mismatchedTx);

      await expect(service.update(dto)).rejects.toThrow(ConflictException);
    });

    it("should update all recurring transactions (scope=ALL)", async () => {
      const rootTx = { ...mockTransaction, id: 1, version: 0, parent: null };
      const childTx = { ...mockTransaction, id: 2, version: 0, parent: rootTx };

      const updateDtoAll = {
        ...dto,
        id: 2,
        scope: UpdateScope.ALL,
        rootVersion: 0,
      };

      // 1. Find da TX clicada (childTx)
      mockTxRepo.findOneWithManager.mockResolvedValueOnce(childTx);
      // 2. getRootTransaction (acha o pai)
      mockEntityManager.findOne.mockResolvedValueOnce(childTx); // (find with parent)
      mockEntityManager.findOne.mockResolvedValueOnce(rootTx); // (find root)
      // 3. findTransactionsByScope (acha raiz e filhas)
      mockEntityManager.findOne.mockResolvedValueOnce(childTx); // (find with parent)
      mockEntityManager.find.mockResolvedValue([rootTx, childTx]); // (find root + children)
      // 4. Find final (retorna a TX clicada)
      mockTxRepo.findOneWithManager.mockResolvedValueOnce(childTx);

      await service.update(updateDtoAll);

      // Verificações
      expect(mockEntityManager.find).toHaveBeenCalledWith(Transaction, {
        where: [{ id: rootTx.id }, { parent: { id: rootTx.id } }],
      });
      // Deve salvar AMBAS transações
      expect(mockTxRepo.saveWithManager).toHaveBeenCalledTimes(2);
      expect(mockTxRepo.saveWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        expect.objectContaining({ id: 1, version: 1 }),
      );
      expect(mockTxRepo.saveWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        expect.objectContaining({ id: 2, version: 1 }),
      );
      // Deve sincronizar taxas e anexos para AMBAS
      expect(mockTaxSvc.detachFromTransactionWithManager).toHaveBeenCalledTimes(
        2,
      );
      expect(mockAttachSvc.removeAllForOwnerWithManager).toHaveBeenCalledTimes(
        2,
      );
    });
  });

  describe("delete", () => {
    const dto: DeleteTransactionDTO = {
      id: 1,
      userId: 1,
      projectId: 1,
      scope: UpdateScope.ONE,
    };

    it("should delete a single transaction (scope=ONE)", async () => {
      mockTxRepo.findOne.mockResolvedValue(mockTransaction);

      await service.delete(dto);

      expect(mockTxRepo.findOne).toHaveBeenCalledWith(
        dto.userId,
        dto.projectId,
        dto.id,
      );
      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockLogService.logDelete).toHaveBeenCalledTimes(1);
      expect(mockAttachSvc.removeAllForOwnerWithManager).toHaveBeenCalledTimes(
        1,
      );
      expect(mockTaxSvc.detachFromTransactionWithManager).toHaveBeenCalledTimes(
        1,
      );
      expect(mockTxRepo.deleteWithManager).toHaveBeenCalledTimes(1);
    });

    it("should delete all recurring transactions (scope=ALL)", async () => {
      const rootTx = { ...mockTransaction, id: 1, version: 0, parent: null };
      const childTx = { ...mockTransaction, id: 2, version: 0, parent: rootTx };

      const deleteAllDto = { ...dto, id: 2, scope: UpdateScope.ALL };

      mockTxRepo.findOne.mockResolvedValue(childTx);
      mockEntityManager.findOne.mockResolvedValueOnce(childTx);
      mockEntityManager.findOne.mockResolvedValueOnce(childTx);
      mockEntityManager.find.mockResolvedValue([rootTx, childTx]);

      await service.delete(deleteAllDto);

      // Deve deletar AMBAS
      expect(mockLogService.logDelete).toHaveBeenCalledTimes(2);
      expect(mockAttachSvc.removeAllForOwnerWithManager).toHaveBeenCalledTimes(
        2,
      );
      expect(mockTaxSvc.detachFromTransactionWithManager).toHaveBeenCalledTimes(
        2,
      );
      expect(mockTxRepo.deleteWithManager).toHaveBeenCalledTimes(2);
    });
  });
});
