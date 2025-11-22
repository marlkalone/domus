import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../../../app.module";
import { DataSource, Repository } from "typeorm";
import { INestApplication } from "@nestjs/common";
import { setupIntegrationTest } from "../../../../test/helpers/integration-test.helper";
import { TransactionService } from "../transaction.service";
import { AttachmentService } from "../../attachment/attachment.service";
import { TaxService } from "../../tax/tax.service";
import { LogService } from "../../log/log.service";
import { User } from "../../../infra/database/entities/user.entity";
import { Project } from "../../../infra/database/entities/project.entity";
import { Contact } from "../../../infra/database/entities/contact.entity";
import { Transaction } from "../../../infra/database/entities/transaction.entity";
import { CreateTransactionDTO } from "../dto/create-transaction.dto";
import {
  PeriodicityType,
  TransactionStatus,
  TransactionType,
} from "../../../common/enums/transaction.enum";
import { UserType, Role } from "../../../common/enums/user.enum";
import { ContactRole, ContactType } from "../../../common/enums/contact.enums";
import {
  AcquisitionType,
  ProjectStatus,
} from "../../../common/enums/project.enum";
import { UpdateTransactionDto } from "../dto/update-transaction.dto";
import { UpdateScope } from "../dto/update-scope.enum";
import { DeleteTransactionDTO } from "../dto/delete-transaction.dto";

// --- Mocks dos Serviços Externos ---
const mockAttachmentService = {
  createRecordsWithManager: jest.fn().mockResolvedValue([]),
  removeAllForOwnerWithManager: jest.fn().mockResolvedValue(undefined),
};
const mockTaxService = {
  attachToTransactionWithManager: jest.fn().mockResolvedValue(undefined),
  detachFromTransactionWithManager: jest.fn().mockResolvedValue(undefined),
};
const mockLogService = {
  logCreate: jest.fn(),
  logUpdate: jest.fn(),
  logDelete: jest.fn(),
};

describe("TransactionService (Integration)", () => {
  const testHelper = setupIntegrationTest();

  let app: INestApplication;
  let transactionService: TransactionService;
  let dataSource: DataSource;

  let userRepo: Repository<User>;
  let projectRepo: Repository<Project>;
  let contactRepo: Repository<Contact>;
  let transactionRepo: Repository<Transaction>;

  // Entidades de Seed
  let testUser: User;
  let testProject: Project;
  let testContact: Contact;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AttachmentService)
      .useValue(mockAttachmentService)
      .overrideProvider(TaxService)
      .useValue(mockTaxService)
      .overrideProvider(LogService)
      .useValue(mockLogService)
      .compile();

    app = testHelper.getApp();
    dataSource = testHelper.getDataSource();

    transactionService = app.get<TransactionService>(TransactionService);
    userRepo = dataSource.getRepository(User);
    projectRepo = dataSource.getRepository(Project);
    contactRepo = dataSource.getRepository(Contact);
    transactionRepo = dataSource.getRepository(Transaction);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    testUser = await userRepo.save({
      name: "TX User",
      email: "tx-user@test.com",
      passwordHash: "hash",
      emailVerified: true,
      phone: "111",
      document: "111",
      type: UserType.INDIVIDUAL,
      role: Role.USER,
      version: 0,
    });

    testProject = await projectRepo.save({
      title: "TX Project",
      acquisitionType: AcquisitionType.PURCHASE,
      status: ProjectStatus.PLANNING,
      version: 0,
      user: testUser,
    });

    testContact = await contactRepo.save({
      name: "TX Contact",
      role: ContactRole.PROVIDER,
      contactType: ContactType.INDIVIDUAL,
      phone: "222",
      version: 0,
      user: testUser,
    });
  });

  it("should be defined", () => {
    expect(transactionService).toBeDefined();
  });

  describe("create (Recurrence)", () => {
    const createDto: CreateTransactionDTO = {
      projectId: 1,
      contactId: 1,
      title: "Recurring Rent",
      category: "Rent",
      type: TransactionType.EXPENSE,
      status: TransactionStatus.TO_INVOICE,
      amount: 1000,
      recurrence: PeriodicityType.RECURRING,
      startDate: "2024-01-15T00:00:00Z",
      endDate: "2024-03-16T00:00:00Z",
    };

    it("should create multiple transactions using the real RecurrenceSplitter", async () => {
      await transactionService.create(testUser.id, {
        ...createDto,
        projectId: testProject.id,
        contactId: testContact.id,
      });

      const transactions = await transactionRepo.find({
        order: { startDate: "ASC" },
        relations: ["parent"],
      });

      // O RecurrenceSplitter deve ter criado 3 transações
      expect(transactions).toHaveLength(3);

      const [root, child1, child2] = transactions;

      // Verifica a raiz
      expect(root.parent).toBeNull();
      expect(root.startDate.toISOString()).toContain("2024-01-15");

      // Verifica as filhas
      expect(child1.parent.id).toBe(root.id);
      expect(child1.startDate.toISOString()).toContain("2024-02-15");
      expect(child2.parent.id).toBe(root.id);
      expect(child2.startDate.toISOString()).toContain("2024-03-15");
    });
  });

  describe("createSaleTransaction (Orchestration)", () => {
    it("should update the Project AND create a new REVENUE Transaction", async () => {
      await transactionService.createSaleTransaction(
        testUser.id,
        testProject.id,
        500000,
        testContact.id,
        new Date(),
      );

      // O Projeto foi atualizado?
      const updatedProject = await projectRepo.findOneBy({
        id: testProject.id,
      });
      expect(updatedProject!.status).toBe(ProjectStatus.SOLD);
      expect(Number(updatedProject!.actualSalePrice)).toBe(500000);
      expect(updatedProject!.version).toBe(1);

      // A Transação foi criada?
      const newTx = await transactionRepo.findOneBy({
        project: { id: testProject.id },
      });
      expect(newTx).toBeDefined();
      expect(newTx!.type).toBe(TransactionType.REVENUE);
      expect(Number(newTx!.amount)).toBe(500000);
    });
  });

  describe("update (Scope = ALL)", () => {
    it("should update all related transactions in the series", async () => {
      const root = await transactionRepo.save({
        ...{
          title: "Old Title",
          category: "Test",
          version: 0,
          project: testProject,
          contact: testContact,
          type: TransactionType.EXPENSE,
          status: TransactionStatus.TO_INVOICE,
          recurrence: PeriodicityType.RECURRING,
          amount: 10,
          startDate: new Date(),
        },
      });
      const child1 = await transactionRepo.save({
        ...{
          title: "Old Title",
          category: "Test",
          version: 0,
          project: testProject,
          contact: testContact,
          type: TransactionType.EXPENSE,
          status: TransactionStatus.TO_INVOICE,
          recurrence: PeriodicityType.RECURRING,
          amount: 10,
          startDate: new Date(),
          parent: root,
        },
      });

      // 2. Ação: Chamar o update em uma das filhas (child1)
      const updateDto: UpdateTransactionDto = {
        id: child1.id, // Atualizando a filha
        userId: testUser.id,
        projectId: testProject.id,
        version: 0, // Versão da filha
        rootVersion: 0, // Versão da raiz
        title: "New Title",
        scope: UpdateScope.ALL,
        category: "Updated",
        status: TransactionStatus.INVOICED,
        amount: 150,
        startDate: new Date().toISOString(),
      };

      await transactionService.update(updateDto);

      const allTxs = await transactionRepo.find();
      expect(allTxs).toHaveLength(2);

      const updatedRoot = allTxs.find((t) => t.id === root.id);
      const updatedChild1 = allTxs.find((t) => t.id === child1.id);

      // O título e a versão de AMBAS devem ter sido atualizados
      expect(updatedRoot!.title).toBe("New Title");
      expect(updatedRoot!.version).toBe(1);
      expect(updatedChild1!.title).toBe("New Title");
      expect(updatedChild1!.version).toBe(1);
    });
  });

  describe("delete (Scope = ALL)", () => {
    it("should delete all related transactions", async () => {
      const root = await transactionRepo.save({
        ...{
          title: "T1",
          category: "Test",
          version: 0,
          project: testProject,
          contact: testContact,
          type: TransactionType.EXPENSE,
          status: TransactionStatus.TO_INVOICE,
          recurrence: PeriodicityType.RECURRING,
          amount: 10,
          startDate: new Date(),
        },
      });
      await transactionRepo.save({
        ...{
          title: "T2",
          category: "Test",
          version: 0,
          project: testProject,
          contact: testContact,
          type: TransactionType.EXPENSE,
          status: TransactionStatus.TO_INVOICE,
          recurrence: PeriodicityType.RECURRING,
          amount: 10,
          startDate: new Date(),
          parent: root,
        },
      });

      const deleteDto: DeleteTransactionDTO = {
        id: root.id, // Deletando a raiz
        userId: testUser.id,
        projectId: testProject.id,
        scope: UpdateScope.ALL,
      };
      await transactionService.delete(deleteDto);

      const count = await transactionRepo.count();
      expect(count).toBe(0); // Todos devem ter sido deletados
    });
  });
});
