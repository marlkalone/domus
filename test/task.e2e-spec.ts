import { INestApplication } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import request from "supertest";
import { User } from "../src/infra/database/entities/user.entity";
import { Project } from "../src/infra/database/entities/project.entity";
import { Contact } from "../src/infra/database/entities/contact.entity";
import { Task } from "../src/infra/database/entities/task.entity";
import { Plan } from "../src/infra/database/entities/plan.entity";
import { Subscription } from "../src/infra/database/entities/subscription.entity";
import { CreateTaskDTO } from "../src/modules/task/dto/create-task.dto";
import { UpdateTaskDTO } from "../src/modules/task/dto/update-task.dto";
import { TaskStatus } from "../src/common/enums/task.enum";
import { UserType, Role } from "../src/common/enums/user.enum";
import { SubscriptionStatus } from "../src/common/enums/subscription.enum";
import {
  ProjectStatus,
  AcquisitionType,
} from "../src/common/enums/project.enum";
import { ContactRole, ContactType } from "../src/common/enums/contact.enums";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { setupE2eTest } from "./helpers/e2e-test.helper";

describe("Task E2E Tests", () => {
  let app: INestApplication;
  let httpServer: any;
  let dataSource: DataSource;

  let userRepo: Repository<User>;
  let projectRepo: Repository<Project>;
  let contactRepo: Repository<Contact>;
  let taskRepo: Repository<Task>;
  let planRepo: Repository<Plan>;
  let subRepo: Repository<Subscription>;

  let jwtService: JwtService;
  let configService: ConfigService;

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
    taskRepo = dataSource.getRepository(Task);
    planRepo = dataSource.getRepository(Plan);
    subRepo = dataSource.getRepository(Subscription);

    jwtService = app.get(JwtService);
    configService = app.get(ConfigService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const proPlan = await planRepo.findOneBy({ code: "PRO" });
    if (!proPlan) throw new Error("Plano PRO não encontrado");

    user = await userRepo.save({
      name: "Task Tester",
      email: `task-${Date.now()}@domus.com`,
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
      stripeSubscriptionId: "sub_task_test",
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

    project = await projectRepo.save({
      title: "Projeto da Tarefa",
      acquisitionType: AcquisitionType.PURCHASE,
      status: ProjectStatus.PLANNING,
      version: 0,
      user: user,
    });

    contact = await contactRepo.save({
      name: "Contato da Tarefa",
      role: ContactRole.COLLABORATOR,
      phone: "88888888888",
      contactType: ContactType.INDIVIDUAL,
      version: 0,
      user: user,
    });
  });

  describe("POST /tasks", () => {
    it("should create a new task linked to project and contact", async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      const dto: CreateTaskDTO = {
        title: "Reunião de Alinhamento",
        description: "Discutir cronograma da obra",
        deadline: dueDate.toISOString(),
        scheduleTime: "14:00",
        status: TaskStatus.PENDING,
        projectId: project.id,
        contactId: contact.id,
      };

      const res = await request(httpServer)
        .post("/api/v2/tasks")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(dto)
        .expect(201);

      console.log(res.body.data);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe(dto.title);

      expect(res.body.data.contact.id).toBe(contact.id);
    });
  });

  describe("GET /tasks", () => {
    it("should list tasks paginated", async () => {
      await taskRepo.save({
        user: user,
        project: project,
        contact: contact,
        title: "Tarefa Listável",
        description: "Desc",
        deadline: new Date(),
        status: TaskStatus.PENDING,
        version: 0,
      });

      const res = await request(httpServer)
        .get("/api/v2/tasks")
        .query({ skip: 0, limit: 10, projectId: String(project.id) })
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.data).toBeInstanceOf(Array);
      expect(res.body.data.data.length).toBeGreaterThan(0);
      expect(res.body.data.total).toBeGreaterThan(0);
    });
  });

  describe("PATCH /tasks/:id", () => {
    it("should update task status", async () => {
      const task = await taskRepo.save({
        user: user,
        project: project,
        contact: contact,
        title: "Tarefa Pendente",
        description: "Desc",
        deadline: new Date(),
        status: TaskStatus.PENDING,
        version: 0,
      });

      const updateDto: UpdateTaskDTO = {
        projectId: project.id, // Obrigatório no DTO
        contactId: contact.id, // Obrigatório no DTO
        status: TaskStatus.COMPLETED,
        version: 0,
      };

      const res = await request(httpServer)
        .patch(`/api/v2/tasks/${task.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(200);

      expect(res.body.data.status).toBe(TaskStatus.COMPLETED);
      expect(res.body.data.version).toBe(1);
    });
  });

  describe("DELETE /tasks/:id", () => {
    it("should delete a task", async () => {
      const task = await taskRepo.save({
        user: user,
        project: project,
        contact: contact,
        title: "Tarefa Deletável",
        description: "Desc",
        deadline: new Date(),
        status: TaskStatus.PENDING,
        version: 0,
      });

      await request(httpServer)
        .delete(`/api/v2/tasks/${task.id}`)
        .query({ projectId: project.id }) // Query obrigatória no Controller
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      const deleted = await taskRepo.findOneBy({ id: task.id });
      expect(deleted).toBeNull();
    });
  });
});
