import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../../../app.module";
import { DataSource, Repository } from "typeorm";
import { INestApplication } from "@nestjs/common";
import { setupIntegrationTest } from "../../../../test/helpers/integration-test.helper";
import { BillingService } from "../billing.service";
import { TransactionService } from "../../transaction/transaction.service";
import { AttachmentService } from "../../attachment/attachment.service";
import { TaxService } from "../../tax/tax.service";
import { LogService } from "../../log/log.service";
import { User } from "../../../infra/database/entities/user.entity";
import { Project } from "../../../infra/database/entities/project.entity";
import { Contact } from "../../../infra/database/entities/contact.entity";
import { Billing } from "../../../infra/database/entities/billing.entity";
import { Transaction } from "../../../infra/database/entities/transaction.entity";
import { UserType, Role } from "../../../common/enums/user.enum";
import {
  AcquisitionType,
  ProjectStatus,
} from "../../../common/enums/project.enum";
import { ContactRole, ContactType } from "../../../common/enums/contact.enums";
import { BillingStatus } from "../../../common/enums/billing.enum";
import { TransactionType } from "../../../common/enums/transaction.enum";
import { ConflictException } from "@nestjs/common";

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

describe("BillingService (Integration)", () => {
  const testHelper = setupIntegrationTest();

  let app: INestApplication;
  let billingService: BillingService;
  let transactionService: TransactionService;
  let dataSource: DataSource;

  // Repositórios Reais
  let userRepo: Repository<User>;
  let projectRepo: Repository<Project>;
  let contactRepo: Repository<Contact>;
  let billingRepo: Repository<Billing>;
  let transactionRepo: Repository<Transaction>;

  // Entidades de Seed
  let testUser: User;
  let testProject: Project;
  let testContact: Contact;
  let testBilling: Billing; // A conta a ser paga

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // 2. Sobrescrever provedores externos
      .overrideProvider(AttachmentService)
      .useValue(mockAttachmentService)
      .overrideProvider(TaxService)
      .useValue(mockTaxService)
      .overrideProvider(LogService)
      .useValue(mockLogService)
      .compile();

    app = testHelper.getApp();
    dataSource = testHelper.getDataSource();

    billingService = app.get<BillingService>(BillingService);
    transactionService = app.get<TransactionService>(TransactionService);
    userRepo = dataSource.getRepository(User);
    projectRepo = dataSource.getRepository(Project);
    contactRepo = dataSource.getRepository(Contact);
    billingRepo = dataSource.getRepository(Billing);
    transactionRepo = dataSource.getRepository(Transaction);
  });

  // 4. Seeding
  beforeEach(async () => {
    jest.clearAllMocks();

    testUser = await userRepo.save({
      name: "Billing User",
      email: "billing-user@test.com",
      passwordHash: "hash",
      emailVerified: true,
      phone: "111",
      document: "111",
      type: UserType.INDIVIDUAL,
      role: Role.USER,
      version: 0,
    });

    testProject = await projectRepo.save({
      title: "Billing Project",
      acquisitionType: AcquisitionType.PURCHASE,
      status: ProjectStatus.PLANNING,
      version: 0,
      user: testUser,
    });

    testContact = await contactRepo.save({
      name: "Billing Contact",
      role: ContactRole.PROVIDER,
      contactType: ContactType.INDIVIDUAL,
      phone: "222",
      version: 0,
      user: testUser,
    });

    testBilling = await billingRepo.save({
      description: "Conta de Luz",
      amount: 150.0,
      billingDate: new Date(),
      dueDate: new Date(),
      status: BillingStatus.PENDING,
      version: 0,
      project: testProject,
      contact: testContact,
    });
  });

  it("should be defined", () => {
    expect(billingService).toBeDefined();
  });

  describe("markAsPaid (Orchestration)", () => {
    it("should mark bill as PAID and create an EXPENSE transaction", async () => {
      const paymentDate = new Date();

      await billingService.markAsPaid(testUser.id, testBilling.id, paymentDate);

      // A conta foi atualizada?
      const updatedBilling = await billingRepo.findOneBy({
        id: testBilling.id,
      });
      expect(updatedBilling!.status).toBe(BillingStatus.PAID);
      expect(updatedBilling!.paymentDate).toBeDefined();

      // A transação foi criada?
      const createdTx = await transactionRepo.findOneBy({
        project: { id: testProject.id },
      });
      expect(createdTx).toBeDefined();
      expect(createdTx!.type).toBe(TransactionType.EXPENSE);
      expect(createdTx!.category).toBe("FROM_BILLING");
      expect(Number(createdTx!.amount)).toBe(150.0);
    });

    it("should throw ConflictException if bill is already paid", async () => {
      testBilling.status = BillingStatus.PAID;
      await billingRepo.save(testBilling);

      await expect(
        billingService.markAsPaid(testUser.id, testBilling.id, new Date()),
      ).rejects.toThrow(ConflictException);

      // Garante que nenhuma transação extra foi criada
      const txCount = await transactionRepo.count();
      expect(txCount).toBe(0);
    });

    it("should ROLLBACK if transaction creation fails", async () => {
      // Mockar o TransactionService (real) para falhar
      jest
        .spyOn(transactionService, "create")
        .mockImplementationOnce(async () => {
          throw new Error("Falha simulada na criação da transação");
        });

      try {
        await billingService.markAsPaid(
          testUser.id,
          testBilling.id,
          new Date(),
        );
      } catch (error) {
        expect(error.message).toContain("Falha simulada");
      }

      // O status do Billing NÃO PODE ter mudado (Rollback)
      const billing = await billingRepo.findOneBy({ id: testBilling.id });
      expect(billing!.status).toBe(BillingStatus.PENDING);

      // Nenhuma transação deve existir
      const txCount = await transactionRepo.count();
      expect(txCount).toBe(0);
    });
  });
});
