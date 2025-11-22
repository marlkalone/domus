import { INestApplication } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import request from "supertest";
import { User } from "../src/infra/database/entities/user.entity";
import { Project } from "../src/infra/database/entities/project.entity";
import { Contact } from "../src/infra/database/entities/contact.entity";
import { Plan } from "../src/infra/database/entities/plan.entity";
import { Subscription } from "../src/infra/database/entities/subscription.entity";
import { CreateTransactionDTO } from "../src/modules/transaction/dto/create-transaction.dto";
import {
  TransactionType,
  PeriodicityType,
  TransactionStatus,
  ExpenseCategory,
} from "../src/common/enums/transaction.enum";
import { UserType, Role } from "../src/common/enums/user.enum";
import {
  ProjectStatus,
  AcquisitionType,
} from "../src/common/enums/project.enum";
import { ContactRole, ContactType } from "../src/common/enums/contact.enums";
import { SubscriptionStatus } from "../src/common/enums/subscription.enum";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { setupE2eTest } from "./helpers/e2e-test.helper";

describe("Transaction E2E Tests", () => {
  let app: INestApplication;
  let httpServer: any;
  let dataSource: DataSource;

  // Repositórios
  let userRepo: Repository<User>;
  let projectRepo: Repository<Project>;
  let contactRepo: Repository<Contact>;
  let planRepo: Repository<Plan>;
  let subRepo: Repository<Subscription>;

  let jwtService: JwtService;
  let configService: ConfigService;

  // Dados de Contexto
  let user: User;
  let accessToken: string;
  let project: Project;
  let contact: Contact;

  beforeAll(async () => {
    const setup = await setupE2eTest();
    app = setup.app;
    httpServer = setup.httpServer;
    dataSource = setup.dataSource;

    userRepo = dataSource.getRepository(User);
    projectRepo = dataSource.getRepository(Project);
    contactRepo = dataSource.getRepository(Contact);
    planRepo = dataSource.getRepository(Plan);
    subRepo = dataSource.getRepository(Subscription);

    jwtService = app.get(JwtService);
    configService = app.get(ConfigService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // 1. Obter Plano PRO (seedado pelo helper)
    const proPlan = await planRepo.findOneBy({ code: "PRO" });

    if (!proPlan) {
      throw new Error("Plano PRO não encontrado no banco de dados de teste.");
    }

    // 2. Criar Usuário
    user = await userRepo.save({
      name: "Transaction Test User",
      email: `tx-e2e-${Date.now()}@domus.com`,
      passwordHash: "$2b$10$FakeHashForSpeed",
      emailVerified: true,
      document: "11122233344",
      phone: "11999999999",
      type: UserType.INDIVIDUAL,
      role: Role.USER,
      version: 1,
      plan: proPlan, // Associa o plano para evitar erro no PlanGuard
    } as any);

    // 3. Criar Assinatura ATIVA (Necessário para o PlanGuard)
    const sub = await subRepo.save({
      user: user,
      plan: proPlan,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(),
      stripeSubscriptionId: "sub_mock_tx_e2e",
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role, // Necessário para RolesGuard
      plan: proPlan.code, // Necessário para PlanGuard
      status: SubscriptionStatus.ACTIVE, // Necessário para PlanGuard
      subscription_id: sub.id,
    };

    accessToken = jwtService.sign(payload, {
      secret: configService.get("JWT_SECRET"),
    });

    // 5. Criar Dependências (Projeto e Contato)
    project = await projectRepo.save({
      title: "Obra Residencial E2E",
      acquisitionType: AcquisitionType.PURCHASE,
      status: ProjectStatus.PLANNING,
      version: 0,
      user: user,
    });

    contact = await contactRepo.save({
      name: "Fornecedor de Materiais",
      role: ContactRole.PROVIDER,
      contactType: ContactType.COMPANY,
      phone: "11888888888",
      version: 0,
      user: user,
    });
  });

  describe("POST /transactions", () => {
    it("should create a simple EXPENSE transaction", async () => {
      const dto: CreateTransactionDTO = {
        title: "Compra de Tijolos",
        amount: 1500.0,
        type: TransactionType.EXPENSE,
        category: ExpenseCategory.CONSTRUCTION,
        recurrence: PeriodicityType.ONE_TIME,
        startDate: new Date().toISOString(),
        status: TransactionStatus.INVOICED,
        projectId: project.id,
        contactId: contact.id,
      };

      const res = await request(httpServer)
        .post("/api/v2/transactions")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(dto)
        .expect(201);

      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.title).toBe(dto.title);
      expect(Number(res.body.data.amount)).toBe(dto.amount);
      expect(res.body.data.project.id).toBe(project.id);
    });

    it("should create RECURRING transactions", async () => {
      // Cria uma recorrência de 3 meses
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3);

      const dto: CreateTransactionDTO = {
        title: "Aluguel de Andaime",
        amount: 500.0,
        type: TransactionType.EXPENSE,
        category: ExpenseCategory.OTHER,
        recurrence: PeriodicityType.RECURRING,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: TransactionStatus.TO_INVOICE,
        projectId: project.id,
        contactId: contact.id,
      };

      const res = await request(httpServer)
        .post("/api/v2/transactions")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(dto)
        .expect(201);

      expect(res.body.data.title).toBe(dto.title);

      // Verifica no banco se foram criadas múltiplas
      const txs = await dataSource.getRepository("Transaction").find({
        where: { title: dto.title, project: { id: project.id } },
      });

      // Esperamos pelo menos 3 ou 4 dependendo de como as datas caem, mas > 1 garante recorrência
      expect(txs.length).toBeGreaterThan(1);
    });
  });

  describe("GET /transactions", () => {
    it("should return a paginated list of transactions", async () => {
      // Seed: Cria uma transação para listar
      await request(httpServer)
        .post("/api/v2/transactions")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          title: "Item Listável",
          amount: 100,
          type: TransactionType.EXPENSE,
          category: ExpenseCategory.UTILITIES,
          recurrence: PeriodicityType.ONE_TIME,
          startDate: new Date().toISOString(),
          status: TransactionStatus.INVOICED,
          projectId: project.id,
          contactId: contact.id,
        });

      const res = await request(httpServer)
        .get("/api/v2/transactions")
        .query({ projectId: String(project.id), skip: 0, limit: 10 })
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.data).toBeInstanceOf(Array);
      expect(res.body.data.data.length).toBeGreaterThan(0);

      expect(res.body.data.total).toBeDefined();
    });
  });

  describe("DELETE /transactions/:id", () => {
    it("should delete a transaction", async () => {
      // 1. Cria
      const createRes = await request(httpServer)
        .post("/api/v2/transactions")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          title: "Para Deletar",
          amount: 50,
          type: TransactionType.EXPENSE,
          category: "TEST",
          recurrence: PeriodicityType.ONE_TIME,
          startDate: new Date().toISOString(),
          status: TransactionStatus.INVOICED,
          projectId: project.id,
          contactId: contact.id,
        });

      const txId = createRes.body.data.id;

      // 2. Deleta
      await request(httpServer)
        .delete(`/api/v2/transactions/${txId}`)
        .query({ projectId: String(project.id) }) // Garante que o parametro obrigatório vai na query
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      // 3. Verifica se sumiu
      const deletedTx = await dataSource
        .getRepository("Transaction")
        .findOneBy({ id: txId });
      expect(deletedTx).toBeNull();
    });
  });
});
