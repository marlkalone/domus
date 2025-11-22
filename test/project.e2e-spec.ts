import { INestApplication } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import request from "supertest";
import { User } from "../src/infra/database/entities/user.entity";
import { Project } from "../src/infra/database/entities/project.entity";
import { Plan } from "../src/infra/database/entities/plan.entity";
import { Subscription } from "../src/infra/database/entities/subscription.entity";
import { CreateProjectDTO } from "../src/modules/project/dto/create-project.dto";
import { UpdateProjectDTO } from "../src/modules/project/dto/update-project.dto";
import {
  AcquisitionType,
  ProjectStatus,
} from "../src/common/enums/project.enum";
import { Role, UserType } from "../src/common/enums/user.enum";
import { SubscriptionStatus } from "../src/common/enums/subscription.enum";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { setupE2eTest } from "./helpers/e2e-test.helper";
import { AddressDTO } from "../src/common/utils/address.dto";
import { ProjectAddress } from "../src/infra/database/entities/projectAddress.entity";

describe("Project E2E Tests", () => {
  let app: INestApplication;
  let httpServer: any;
  let dataSource: DataSource;

  let userRepo: Repository<User>;
  let projectRepo: Repository<Project>;
  let planRepo: Repository<Plan>;
  let projectAddressRepo: Repository<ProjectAddress>;
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
    projectRepo = dataSource.getRepository(Project);
    projectAddressRepo = dataSource.getRepository(ProjectAddress);
    planRepo = dataSource.getRepository(Plan);
    subRepo = dataSource.getRepository(Subscription);

    jwtService = app.get(JwtService);
    configService = app.get(ConfigService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // 1. Obter Plano (PRO)
    const proPlan = await planRepo.findOneBy({ code: "PRO" });
    if (!proPlan) throw new Error("Plano PRO não encontrado (seed falhou?)");

    // 2. Criar Usuário
    user = await userRepo.save({
      name: "Project Tester",
      email: `proj-${Date.now()}@domus.com`,
      passwordHash: "hashed_secret",
      emailVerified: true,
      document: "12345678900",
      phone: "11900000000",
      type: UserType.INDIVIDUAL,
      role: Role.USER,
      version: 1,
      plan: proPlan,
    } as any);

    // 3. Criar Assinatura Ativa
    const sub = await subRepo.save({
      user: user,
      plan: proPlan,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(),
      stripeSubscriptionId: "sub_proj_test",
    });

    // 4. Gerar Token
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

  describe("POST /projects", () => {
    it("should create a new project successfully", async () => {
      const dto: CreateProjectDTO = {
        title: "Casa de Praia",
        acquisition_type: AcquisitionType.PURCHASE,
        status: ProjectStatus.PLANNING,
        acquisitionPrice: 250000,
        targetSalePrice: 400000,
        address: {
          zipCode: "12345-000",
          street: "Av. Oceano",
          number: "404",
          neighborhood: "Praia",
          city: "Litoral",
          state: "SP",
        },
        details: [],
        attachs: [],
      };

      const res = await request(httpServer)
        .post("/api/v2/projects")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(dto)
        .expect(201);

      // Verifica a resposta encapsulada em .data
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe(dto.title);
      expect(res.body.data.address.street).toBe(dto.address.street);
    });
  });

  describe("GET /projects", () => {
    it("should list projects paginated", async () => {
      // Seed: cria um projeto para listar
      const proj = await projectRepo.save({
        user: user,
        title: "Projeto Listável",
        acquisitionType: AcquisitionType.PURCHASE,
        status: ProjectStatus.PLANNING,
        version: 1,
      });

      await projectAddressRepo.save({
        project: proj,
        zipCode: "00000-000",
        street: "Rua Teste",
        number: "10",
        neighborhood: "Bairro",
        city: "Cidade",
        state: "TS",
      });

      const res = await request(httpServer)
        .get("/api/v2/projects")
        .query({ skip: 0, limit: 10 })
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.data).toBeInstanceOf(Array);
      expect(res.body.data.data.length).toBeGreaterThan(0);
      expect(res.body.data.total).toBeGreaterThan(0);
    });
  });

  describe("PATCH /projects/:id", () => {
    it("should update project details", async () => {
      // 1. Cria
      const project = await projectRepo.save({
        user: user,
        title: "Projeto Antigo",
        acquisitionType: AcquisitionType.PURCHASE,
        status: ProjectStatus.PLANNING,
        version: 0,
      });

      await projectAddressRepo.save({
        project: project,
        zipCode: "11111-111",
        street: "Rua Antiga",
        number: "1",
        neighborhood: "Bairro Antigo",
        city: "Cidade Antiga",
        state: "AA",
      });

      const mockAddressDto: AddressDTO = {
        zipCode: "12345-678",
        street: "Test St",
        number: "100",
        neighborhood: "Test Neighborhood",
        city: "Test City",
        state: "TS",
      };

      // 2. Atualiza
      const updateDto: UpdateProjectDTO = {
        title: "Projeto Renovado",
        acquisitionPrice: 120000,
        acquisition_type: AcquisitionType.PURCHASE,
        targetSalePrice: 250000,
        status: ProjectStatus.LISTED,
        address: mockAddressDto,
        version: 0,
      };

      const res = await request(httpServer)
        .patch(`/api/v2/projects/${project.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(200);

      expect(res.body.data.title).toBe("Projeto Renovado");
      expect(res.body.data.status).toBe(ProjectStatus.LISTED);
      expect(res.body.data.version).toBe(1);
      expect(res.body.data.address.street).toBe("Test St");
    });
  });

  describe("DELETE /projects/:id", () => {
    it("should delete a project", async () => {
      // 1. Cria
      const project = await projectRepo.save({
        user: user,
        title: "Projeto Deletável",
        acquisitionType: AcquisitionType.PURCHASE,
        status: ProjectStatus.PLANNING,
        version: 0,
      });

      // 2. Deleta
      await request(httpServer)
        .delete(`/api/v2/projects/${project.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      // 3. Verifica
      const deleted = await projectRepo.findOneBy({ id: project.id });
      expect(deleted).toBeNull();
    });
  });
});
