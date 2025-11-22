import { Repository } from "typeorm";
import { ConflictException } from "@nestjs/common";
import { setupIntegrationTest } from "../../../../test/helpers/integration-test.helper";
import { AdminService } from "../admin.service";
import { UserService } from "../../user/user.service";
import { ProjectService } from "../../project/project.service";
import { Plan } from "../../../infra/database/entities/plan.entity";
import { UserAddress } from "../../../infra/database/entities/userAddress.entity";
import { Subscription } from "../../../infra/database/entities/subscription.entity";
import { Project } from "../../../infra/database/entities/project.entity";
import { User } from "../../../infra/database/entities/user.entity";
import { Role, UserType } from "../../../common/enums/user.enum";
import { CreateAdminDTO } from "../dto/create-admin.dto";
import { SubscriptionStatus } from "../../../common/enums/subscription.enum";
import { ProjectStatus } from "../../../common/enums/project.enum";

jest.mock("bcrypt", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password_admin"),
}));

describe("AdminService (Integration)", () => {
  const testHelper = setupIntegrationTest();

  let adminService: AdminService;
  let userService: UserService;
  let projectService: ProjectService;

  let planRepo: Repository<Plan>;
  let userRepo: Repository<User>;
  let addressRepo: Repository<UserAddress>;
  let subRepo: Repository<Subscription>;
  let projectRepo: Repository<Project>;

  let testUser: User;

  beforeAll(async () => {
    // Aguarda o app iniciar do helper
    const app = testHelper.getApp();
    const dataSource = testHelper.getDataSource();

    // Pega os serviços reais
    adminService = app.get<AdminService>(AdminService);
    userService = app.get<UserService>(UserService);
    projectService = app.get<ProjectService>(ProjectService);

    // Pega os repositórios reais
    planRepo = dataSource.getRepository(Plan);
    userRepo = dataSource.getRepository(User);
    addressRepo = dataSource.getRepository(UserAddress);
    subRepo = dataSource.getRepository(Subscription);
    projectRepo = dataSource.getRepository(Project);
  });

  beforeEach(async () => {
    // Seed: Recrie os dados essenciais ANTES de cada teste
    await planRepo.save([
      { code: "FREE", name: "Free", price: 0, isActive: true },
      { code: "PRO", name: "Pro", price: 100, isActive: true },
    ]);

    testUser = await userRepo.save({
      name: "Test User",
      email: "user@test.com",
      passwordHash: "hash",
      emailVerified: true,
      phone: "111",
      document: "111",
      type: UserType.INDIVIDUAL,
      role: Role.USER,
      version: 0,
    });
  });

  it("should be defined", () => {
    expect(adminService).toBeDefined();
  });

  describe("create (Admin)", () => {
    const createDto: CreateAdminDTO = {
      name: "New Admin",
      email: "admin@test.com",
      password: "Password123!",
      phone: "999",
      document: "999",
      type: UserType.INDIVIDUAL,
    };

    it("should create an admin, address, and ACTIVE Subscription", async () => {
      const newAdmin = await adminService.create(createDto);

      expect(newAdmin.id).toBeDefined();
      expect(newAdmin.role).toBe(Role.ADMIN);
      expect(newAdmin.emailVerified).toBe(true);

      const dbAddress = await addressRepo.findOneBy({
        user: { id: newAdmin.id },
      });
      expect(dbAddress).toBeDefined();
      expect(dbAddress!.street).toBe("Admin Street");

      const dbSub = await subRepo.findOne({
        where: { user: { id: newAdmin.id } },
        relations: ["plan"],
      });
      expect(dbSub).toBeDefined();
      expect(dbSub!.status).toBe(SubscriptionStatus.ACTIVE);
      expect(dbSub!.plan!.code).toBe("PRO");
    });

    it("should throw ConflictException if email already in use", async () => {
      await expect(
        adminService.create({
          ...createDto,
          email: "user@test.com",
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("getProjectStats", () => {
    it("should correctly aggregate project stats", async () => {
      await projectRepo.save([
        {
          title: "Proj 1",
          acquisitionType: "purchase",
          status: ProjectStatus.SOLD,
          version: 0,
          user: testUser,
        },
        {
          title: "Proj 2",
          acquisitionType: "purchase",
          status: ProjectStatus.SOLD,
          version: 0,
          user: testUser,
        },
        {
          title: "Proj 3",
          acquisitionType: "purchase",
          status: ProjectStatus.RENOVATION,
          version: 0,
          user: testUser,
        },
      ]);

      const stats = await adminService.getProjectStats();

      expect(stats.total).toBe(3);
      expect(stats[ProjectStatus.SOLD]).toBe(2);
      expect(stats[ProjectStatus.RENOVATION]).toBe(1);
      expect(stats[ProjectStatus.PLANNING]).toBe(0);
    });
  });

  describe("getUserStats", () => {
    it("should return user stats", async () => {
      await userRepo.save({
        name: "Company User",
        email: "company@test.com",
        passwordHash: "hash",
        emailVerified: true,
        phone: "222",
        document: "222",
        type: UserType.COMPANY,
        role: Role.USER,
        version: 0,
      });

      const stats = await adminService.getUserStats();

      // (O testUser + Company User)
      expect(stats.total).toBe(2);
      expect(stats.individual).toBe(1); // testUser
      expect(stats.company).toBe(1); // Company User
    });
  });

  describe("deleteUser", () => {
    it("should delete a user and all related data (via cascade)", async () => {
      await adminService.deleteUser(testUser.id);

      const dbUser = await userRepo.findOneBy({ id: testUser.id });
      expect(dbUser).toBeNull();
    });
  });
});
