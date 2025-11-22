import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../../../app.module";
import { DataSource, Repository } from "typeorm";
import { INestApplication } from "@nestjs/common";
import { ProjectService } from "../project.service";
import { AttachmentService } from "../../attachment/attachment.service";
import { User } from "../../../infra/database/entities/user.entity";
import { Project } from "../../../infra/database/entities/project.entity";
import { ProjectAddress } from "../../../infra/database/entities/projectAddress.entity";
import { ProjectDetail } from "../../../infra/database/entities/projectDetail.entity";
import { CreateProjectDTO } from "../dto/create-project.dto";
import {
  AcquisitionType,
  ProjectStatus,
} from "../../../common/enums/project.enum";
import { UserType, Role } from "../../../common/enums/user.enum";
import { UpdateProjectDTO } from "../dto/update-project.dto";
import { ProjectFilterDTO } from "../dto/project-filter.dto";

// 1. Mock do AttachmentService (para evitar chamadas reais à AWS)
const mockAttachmentService = {
  createRecordsWithManager: jest.fn().mockResolvedValue([]),
  removeAllForOwnerWithManager: jest.fn().mockResolvedValue(undefined),
  queueCleanupJob: jest.fn().mockResolvedValue(undefined),
};

const cleanDatabase = async (dataSource: DataSource) => {
  await dataSource.query(
    'TRUNCATE "users", "plans", "projects" RESTART IDENTITY CASCADE;',
  );
};

describe("ProjectService (Integration)", () => {
  let app: INestApplication;
  let projectService: ProjectService;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let projectRepo: Repository<Project>;
  let addressRepo: Repository<ProjectAddress>;
  let detailRepo: Repository<ProjectDetail>;

  let testUser: User; // Usuário dono dos projetos

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AttachmentService)
      .useValue(mockAttachmentService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    projectService = app.get<ProjectService>(ProjectService);
    dataSource = app.get<DataSource>(DataSource);
    userRepo = dataSource.getRepository(User);
    projectRepo = dataSource.getRepository(Project);
    addressRepo = dataSource.getRepository(ProjectAddress);
    detailRepo = dataSource.getRepository(ProjectDetail);

    await cleanDatabase(dataSource);
  });

  // 5. Cria o usuário 'dono' antes de cada teste
  beforeEach(async () => {
    await cleanDatabase(dataSource);

    // (O attachmentService é mockado, então não precisamos dos planos/subs)
    testUser = await userRepo.save({
      name: "Project Test User",
      email: "project-user@test.com",
      passwordHash: "hash",
      emailVerified: true,
      phone: "111",
      document: "111",
      type: UserType.INDIVIDUAL,
      role: Role.USER,
      version: 0,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("should be defined", () => {
    expect(projectService).toBeDefined();
  });

  it("should CREATE a project, address, and details atomically", async () => {
    const createDto: CreateProjectDTO = {
      title: "New Project",
      acquisition_type: AcquisitionType.PURCHASE,
      acquisitionPrice: 100000,
      address: {
        street: "Main St",
        number: "123",
        zipCode: "12345-000",
        neighborhood: "Downtown",
        city: "Testville",
        state: "TS",
      },
      details: [{ key: "bedrooms", value: "3" }],
      attachs: [],
    };

    const project = await projectService.create(testUser.id, createDto);

    expect(project.id).toBeDefined();
    expect(project.title).toBe("New Project");

    // Endereço
    const dbAddress = await addressRepo.findOneBy({
      project: { id: project.id },
    });
    expect(dbAddress).toBeDefined();
    expect(dbAddress!.street).toBe("Main St");

    // Detalhes
    const dbDetails = await detailRepo.findBy({ project: { id: project.id } });
    expect(dbDetails).toHaveLength(1);
    expect(dbDetails[0].key).toBe("bedrooms");
    expect(dbDetails[0].value).toBe("3");
  });

  it("should UPDATE project and correctly add/update/remove details in a transaction", async () => {
    const address = addressRepo.create({
      street: "Old St",
      number: "1",
      zipCode: "111",
      neighborhood: "Old",
      city: "Old",
      state: "OO",
    });

    const initialProject = await projectRepo.save({
      title: "Initial Project",
      acquisitionType: AcquisitionType.PURCHASE,
      status: ProjectStatus.PLANNING,
      version: 0,
      user: testUser,
      address: address,
    });

    // Salva detalhes iniciais
    await detailRepo.save([
      { key: "bedrooms", value: "3", project: initialProject },
      { key: "bathrooms", value: "2", project: initialProject },
    ]);

    const updateDto: UpdateProjectDTO = {
      version: 0,
      title: "Updated Project",
      status: ProjectStatus.RENOVATION,
      acquisition_type: AcquisitionType.PURCHASE,
      acquisitionPrice: 1,
      targetSalePrice: 2,
      address: {
        street: "New St", // Endereço atualizado
        number: "123",
        zipCode: "12345-000",
        neighborhood: "Downtown",
        city: "Testville",
        state: "TS",
      },
      details: [
        { key: "bedrooms", value: "4" }, // 1. ATUALIZAR
        { key: "area", value: "100" }, // 2. ADICIONAR
      ],
      attachmentKeys: [],
    };

    await projectService.update(testUser.id, initialProject.id, updateDto);

    // Projeto principal foi atualizado?
    const updatedProject = await projectRepo.findOneBy({
      id: initialProject.id,
    });
    expect(updatedProject!.title).toBe("Updated Project");
    expect(updatedProject!.version).toBe(1);

    // Endereço foi atualizado?
    const updatedAddress = await addressRepo.findOneBy({
      project: { id: initialProject.id },
    });
    expect(updatedAddress!.street).toBe("New St");

    // Detalhes foram sincronizados?
    const finalDetails = await detailRepo.findBy({
      project: { id: initialProject.id },
    });
    expect(finalDetails).toHaveLength(2); // (bathrooms foi removido, area foi adicionado)

    const detailKeys = finalDetails.map((d) => d.key);
    expect(detailKeys).toContain("bedrooms");
    expect(detailKeys).toContain("area");
    expect(detailKeys).not.toContain("bathrooms");

    const bedroomDetail = finalDetails.find((d) => d.key === "bedrooms");
    expect(bedroomDetail!.value).toBe("4");
  });

  it("should FIND paginated projects using repository filters", async () => {
    await projectRepo.save([
      {
        title: "Sold Project",
        acquisitionType: "purchase",
        status: ProjectStatus.SOLD,
        version: 0,
        user: testUser,
      },
      {
        title: "Reno Project 1",
        acquisitionType: "purchase",
        status: ProjectStatus.RENOVATION,
        version: 0,
        user: testUser,
      },
      {
        title: "Reno Project 2",
        acquisitionType: "purchase",
        status: ProjectStatus.RENOVATION,
        version: 0,
        user: testUser,
      },
    ]);

    const filter: ProjectFilterDTO = {
      status: ProjectStatus.RENOVATION,
      skip: 0,
      limit: 10,
    };

    const result = await projectService.findAll(testUser.id, filter);

    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].title).toContain("Reno Project");
  });
});
