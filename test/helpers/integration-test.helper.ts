import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { DataSource } from "typeorm";
import { INestApplication } from "@nestjs/common";

// Esta é a nossa função de limpeza que será usada em todos os testes
export const cleanDatabase = async (dataSource: DataSource) => {
  const entities = [
    "users",
    "plans",
    "projects",
    "contacts",
    "tasks",
    "transactions",
    "billings",
    "amenities",
  ];

  await dataSource.query(
    `TRUNCATE ${entities.map((e) => `"${e}"`).join(", ")} RESTART IDENTITY CASCADE;`,
  );
};

// Esta função inicializa o app e configura os hooks de limpeza
export const setupIntegrationTest = () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get<DataSource>(DataSource);

    // Limpa o banco UMA VEZ antes de começar a suíte
    await cleanDatabase(dataSource);
  });

  // Mude de afterEach para beforeEach
  beforeEach(async () => {
    // Limpa o banco ANTES de CADA teste
    await cleanDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  // Retorna os objetos que os testes precisarão
  return {
    getApp: () => app,
    getDataSource: () => dataSource,
  };
};
