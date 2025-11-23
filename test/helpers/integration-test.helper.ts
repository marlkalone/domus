import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from "../../src/app.module";
import { DataSource } from 'typeorm';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import {QueueProducerService} from "../../src/infra/queue/queue.producer.service";
import {MailService} from "../../src/infra/mail/mail.service";
import {StorageService} from "../../src/infra/storage/storage.service";
import {StripeService} from "../../src/infra/stripe/stripe.service";

export const cleanDatabase = async (dataSource: DataSource) => {
    if (!dataSource || !dataSource.isInitialized) return;

    const entities = dataSource.entityMetadatas;
    const tableNames = entities
        .map((entity) => `"${entity.tableName}"`)
        .join(', ');

    if (tableNames.length > 0) {
        await dataSource.query(`TRUNCATE ${tableNames} RESTART IDENTITY CASCADE;`);
    }
};

export const setupIntegrationTest = () => {
    let app: INestApplication;
    let dataSource: DataSource;

    const mockQueueProducerService = {
        sendMessage: jest.fn().mockResolvedValue({ MessageId: 'mock-msg-id' }),
        sendBatchMessages: jest.fn().mockResolvedValue({ Successful: [], Failed: [] }),
    };

    const mockMailService = {
        sendEmail: jest.fn().mockResolvedValue({ MessageId: 'mock-email-id' }),
    };

    const mockStorageService = {
        uploadFile: jest.fn().mockResolvedValue({ Key: 'mock-key', Location: 'mock-url' }),
        deleteFile: jest.fn().mockResolvedValue({}),
        getSignedUrl: jest.fn().mockReturnValue('https://mock-signed-url.com'),
    };

    const mockStripeService = {
        createCustomer: jest.fn().mockResolvedValue({ id: 'cus_mock_123', object: 'customer' }),
        retrieveCustomer: jest.fn().mockResolvedValue({ id: 'cus_mock_123', object: 'customer' }),
        createCheckoutSession: jest.fn().mockResolvedValue({ id: 'cs_test_123', url: 'http://mock-stripe.com' }),
        retrieveCheckoutSession: jest.fn().mockResolvedValue({ payment_status: 'paid' }),
        createPortalSession: jest.fn().mockResolvedValue({ url: 'http://mock-portal.com' }),
        retrieveSubscription: jest.fn().mockResolvedValue({ status: 'active', items: { data: [] } }),
        listPrices: jest.fn().mockResolvedValue({ data: [] }),
        constructEvent: jest.fn().mockReturnValue({ type: 'test.event' }),
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(QueueProducerService)
            .useValue(mockQueueProducerService)
            .overrideProvider(MailService)
            .useValue(mockMailService)
            .overrideProvider(StorageService)
            .useValue(mockStorageService)
            .overrideProvider(StripeService)
            .useValue(mockStripeService)
            .compile();

        app = moduleFixture.createNestApplication();

        app.useGlobalPipes(
            new ValidationPipe({
                transform: true,
                whitelist: true,
                forbidNonWhitelisted: true,
            }),
        );

        await app.init();

        dataSource = app.get<DataSource>(DataSource);
        await cleanDatabase(dataSource);
    });

    beforeEach(async () => {
        if (dataSource && dataSource.isInitialized) {
            await cleanDatabase(dataSource);
        }
        jest.clearAllMocks();
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });

    return {
        getApp: () => app,
        getDataSource: () => dataSource,
    };
};