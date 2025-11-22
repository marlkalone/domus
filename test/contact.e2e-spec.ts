import { INestApplication } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import request from "supertest";
import { User } from "../src/infra/database/entities/user.entity";
import { Contact } from "../src/infra/database/entities/contact.entity";
import { Plan } from "../src/infra/database/entities/plan.entity";
import { Subscription } from "../src/infra/database/entities/subscription.entity";
import { CreateContactDTO } from "../src/modules/contact/dto/create-contact.dto";
import { ContactRole, ContactType } from "../src/common/enums/contact.enums";
import { UserType, Role } from "../src/common/enums/user.enum";
import { SubscriptionStatus } from "../src/common/enums/subscription.enum";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { setupE2eTest } from "./helpers/e2e-test.helper";

describe("Contact E2E Tests", () => {
  let app: INestApplication;
  let httpServer: any;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let contactRepo: Repository<Contact>;
  let planRepo: Repository<Plan>;
  let subRepo: Repository<Subscription>;
  let jwtService: JwtService;
  let configService: ConfigService;

  let user: User;
  let accessToken: string;

  beforeAll(async () => {
    const setup = await setupE2eTest();
    app = setup.app;
    httpServer = setup.httpServer;
    dataSource = setup.dataSource;
    userRepo = dataSource.getRepository(User);
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
    // 1. Configurar Usuário com Plano e Assinatura (Padrão para passar nos Guards)
    const proPlan = await planRepo.findOneBy({ code: "PRO" });
    if (!proPlan) throw new Error("Plano PRO não encontrado");

    user = await userRepo.save({
      name: "Contact Tester",
      email: `contact-${Date.now()}@domus.com`,
      passwordHash: "hashed_secret",
      emailVerified: true,
      document: "12345678900",
      phone: "11900000000",
      type: UserType.INDIVIDUAL,
      role: Role.USER,
      version: 1,
      plan: proPlan,
    } as any);

    const sub = await subRepo.save({
      user: user,
      plan: proPlan,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(),
      stripeSubscriptionId: "sub_contact_test",
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      plan: proPlan.code,
      status: SubscriptionStatus.ACTIVE,
      subscription_id: sub.id,
    };

    accessToken = jwtService.sign(payload, {
      secret: configService.get("JWT_SECRET"),
    });
  });

  describe("POST /contacts", () => {
    it("should create a new contact", async () => {
      const dto: CreateContactDTO = {
        name: "Eletricista João",
        role: ContactRole.PROVIDER,
        contactType: ContactType.INDIVIDUAL,
        email: "joao@eletrica.com",
        phone: "11999998888",
        // details e address são opcionais, mas bom enviar vazio se o DTO exigir
      };

      const res = await request(httpServer)
        .post("/api/v2/contacts")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(dto)
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.name).toBe(dto.name);
      expect(res.body.data.role).toBe(dto.role);
    });
  });

  describe("GET /contacts", () => {
    it("should list contacts", async () => {
      await contactRepo.save({
        user: user,
        name: "Fornecedor Listável",
        phone: "88888888888",
        role: ContactRole.PROVIDER,
        contactType: ContactType.COMPANY,
        version: 0,
      });

      const res = await request(httpServer)
        .get("/api/v2/contacts")
        .query({ skip: 0, limit: 10 })
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.data).toBeInstanceOf(Array);
      expect(res.body.data.data.length).toBeGreaterThan(0);
    });
  });

  describe("DELETE /contacts/:id", () => {
    it("should delete a contact", async () => {
      const contact = await contactRepo.save({
        user: user,
        name: "Contato Deletável",
        phone: "88888888888",
        role: ContactRole.TENANT,
        contactType: ContactType.INDIVIDUAL,
        version: 0,
      });

      await request(httpServer)
        .delete(`/api/v2/contacts/${contact.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      const deleted = await contactRepo.findOneBy({ id: contact.id });
      expect(deleted).toBeNull();
    });
  });
});
