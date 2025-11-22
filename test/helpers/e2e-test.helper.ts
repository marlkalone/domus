import { Test, TestingModule, TestingModuleBuilder } from "@nestjs/testing";
import {
  ExecutionContext,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { AppModule } from "../../src/app.module";
import { DataSource } from "typeorm";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Plan } from "../../src/infra/database/entities/plan.entity";
import { PermissionCacheService } from "../../src/modules/permission-cache/permission-cache.service";
import { StripeService } from "../../src/infra/stripe/stripe.service";
import { QueueProducerService } from "../../src/infra/queue/queue.producer.service";
import { EmailConsumer } from "../../src/infra/queue/email.consumer";
import { StorageConsumer } from "../../src/infra/queue/storage.consumer";
import { StripeWebhookGuard } from "../../src/common/guards/stripe-webhook.guard";

type OverrideCallback = (builder: TestingModuleBuilder) => TestingModuleBuilder;

/**
 * Configura o ambiente E2E completo.
 * Mantém serviços reais (Mail, S3, etc), mas gerencia o Banco de Dados e Throttler.
 */
export const setupE2eTest = async (overrideFn?: OverrideCallback) => {
  const stripeServiceMock = {
    createCustomer: jest.fn().mockResolvedValue({ id: "cus_mock_e2e" }),
    listPrices: jest.fn().mockResolvedValue({ data: [] }),
    createCheckoutSession: jest
      .fn()
      .mockResolvedValue({ id: "sess_mock", url: "http://mock" }),
    constructEvent: jest.fn().mockImplementation((payload) => payload),
    retrieveSubscription: jest.fn().mockResolvedValue({ status: "active" }),
  };

  // Mock do Producer SQS para evitar envio de mensagens (InvalidClientTokenId)
  const queueProducerMock = {
    sendEmailJob: jest.fn().mockResolvedValue({ MessageId: "msg_mock_123" }),
    sendStorageJob: jest.fn().mockResolvedValue({ MessageId: "msg_mock_456" }),
  };

  // Mock dos Consumers para evitar polling no SQS (SQS receive message failed)
  // Simulamos métodos vazios para que eles não tentem conectar na AWS ao iniciar
  const consumerMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    handleMessage: jest.fn(),
  };

  let builder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(StripeWebhookGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest();
        req.event = req.body;
        return true;
      },
    })
    .overrideProvider(StripeService)
    .useValue(stripeServiceMock)
    .overrideProvider(QueueProducerService)
    .useValue(queueProducerMock)
    .overrideProvider(EmailConsumer)
    .useValue(consumerMock)
    .overrideProvider(StorageConsumer)
    .useValue(consumerMock);

  const permissionsMap = new Map<string, any>([
    ["PROJECT_MAX_COUNT", 999],
    ["PROJECT_PHOTO_LIMIT", 999],
    ["PROJECT_VIDEO_LIMIT", 999],
    ["AMENITIES_PER_PROJECT", 999],
    ["CONTACT_MAX_COUNT", 999],
    ["TASK_ACTIVE_LIMIT", 999],
    ["TX_MONTHLY_LIMIT", 999],
    ["TAX_ENABLED", true],
    ["ATTACH_TOTAL_COUNT", 999],
  ]);

  const permissionCacheMock = {
    onModuleInit: jest.fn().mockResolvedValue(true),
    getPermissionsForPlan: jest.fn().mockResolvedValue(permissionsMap),
  };
  builder = builder
    .overrideProvider(PermissionCacheService)
    .useValue(permissionCacheMock);

  // 3. Overrides Específicos do Teste (ex: Mockar Stripe)
  if (overrideFn) {
    builder = overrideFn(builder);
  }

  const moduleFixture: TestingModule = await builder.compile();

  const app = moduleFixture.createNestApplication();

  // Configuração Global (Igual ao main.ts)
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "2",
    prefix: "v",
  });

  // Preparação do Banco de Dados ANTES do app.init()
  const dataSource = app.get<DataSource>(DataSource);
  await cleanDatabase(dataSource);
  await seedBasicPlan(dataSource);

  // Inicializa a aplicação
  await app.init();

  return {
    app,
    httpServer: app.getHttpServer(),
    dataSource,
  };
};

export const cleanDatabase = async (dataSource: DataSource) => {
  if (!dataSource.isInitialized) return;
  const entities = dataSource.entityMetadatas;
  const tableNames = entities
    .map((entity) => `"${entity.tableName}"`)
    .join(", ");

  if (tableNames.length > 0) {
    try {
      await dataSource.query(
        `TRUNCATE ${tableNames} RESTART IDENTITY CASCADE;`,
      );
    } catch (error) {
      console.warn("CleanDB Warning:", error.message);
    }
  }
};

const seedBasicPlan = async (dataSource: DataSource) => {
  const planRepo = dataSource.getRepository(Plan);

  // Cria planos essenciais para testes de assinatura
  const plans = [
    { code: "FREE", name: "Free Plan", price: 0, isActive: true },
    { code: "PRO", name: "Pro Plan", price: 99.9, isActive: true },
  ];

  for (const p of plans) {
    const exists = await planRepo.findOneBy({ code: p.code });
    if (!exists) {
      await planRepo.save(p);
    }
  }
};
