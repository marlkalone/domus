import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { BadRequestException } from "@nestjs/common";
import { EntityManager } from "typeorm";
import Stripe from "stripe";
import { SubscriptionService } from "../subscription.service";
import { User } from "../../../infra/database/entities/user.entity";
import { Plan } from "../../../infra/database/entities/plan.entity";
import { Subscription } from "../../../infra/database/entities/subscription.entity";
import { SubscriptionStatus } from "../../../common/enums/subscription.enum";
import { StripeService } from "../../../infra/stripe/stripe.service";
import { SubscriptionRepository } from "../repository/subscription.repository";
import { UserService } from "../../user/user.service";
import { PlanService } from "../plan.service";
import { QueueProducerService } from "../../../infra/queue/queue.producer.service";
import { TransactionManagerService } from "../../../infra/database/transaction-manager.service";
import { LogService } from "../../log/log.service";

const mockEntityManager = {};

describe("SubscriptionService", () => {
  let service: SubscriptionService;
  let mockStripeService: any;
  let mockRepo: any;
  let mockUserService: any;
  let mockPlanService: any;
  let mockConfigService: any;
  let mockQueueProducerService: any;
  let mockTxManager: any;
  let mockLogService: any;

  const mockUser: User = {
    id: 1,
    email: "test@user.com",
    name: "Test User",
    stripeCustomerId: null,
  } as any;

  const mockUserWithId: User = {
    ...mockUser,
    stripeCustomerId: "cus_123",
  } as User;

  const mockPlan: Plan = {
    id: 1,
    code: "PRO",
    name: "Pro Plan",
  } as Plan;

  const mockPendingSub: Subscription = {
    id: 1,
    user: mockUser,
    plan: mockPlan,
    status: SubscriptionStatus.PENDING,
  } as Subscription;

  const mockActiveSub: Subscription = {
    ...mockPendingSub,
    status: SubscriptionStatus.ACTIVE,
    stripeSubscriptionId: "sub_123",
    user: mockUserWithId,
  } as Subscription;

  // Mocks de objetos do Stripe
  const mockStripeSubscription = {
    id: "sub_123",
    status: "active",
    metadata: { userId: "1", planKey: "PRO" },
    items: {
      data: [
        { current_period_start: 1700000000, current_period_end: 1700003600 },
      ],
    },
  } as unknown as Stripe.Subscription;

  const mockStripeCheckoutSession = {
    subscription: "sub_123",
  } as Stripe.Checkout.Session;

  const mockStripeInvoice = {
    subscription: "sub_123",
    amount_paid: 10000, // 100.00 BRL
    user: mockUserWithId,
    plan: mockPlan,
  } as unknown as Stripe.Invoice;

  beforeEach(async () => {
    // Inicialização dos mocks
    mockStripeService = {
      retrieveSubscription: jest.fn(),
      listPrices: jest.fn(),
      createCheckoutSession: jest.fn(),
      createCustomer: jest.fn(),
    };
    mockRepo = {
      findLatestByUser: jest.fn(),
      createOrUpdate: jest.fn(),
      findByStripeId: jest.fn(),
    };
    mockUserService = {
      findById: jest.fn(),
      saveUser: jest.fn(),
    };
    mockPlanService = {
      findByCode: jest.fn(),
    };
    mockConfigService = {
      get: jest.fn(),
    };
    mockQueueProducerService = {
      sendEmailJob: jest.fn(),
    };
    mockLogService = {
      logCreate: jest.fn(),
      logUpdate: jest.fn(),
    };
    mockTxManager = {
      run: jest.fn().mockImplementation(async (callback) => {
        // Executa o callback imediatamente com o mock manager
        return await callback(mockEntityManager as unknown as EntityManager);
      }),
    };

    // Configuração específica para o ConfigService
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === "FRONTEND_URL") return "http://localhost:3000";
      return null;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: StripeService, useValue: mockStripeService },
        { provide: SubscriptionRepository, useValue: mockRepo },
        { provide: UserService, useValue: mockUserService },
        { provide: PlanService, useValue: mockPlanService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: QueueProducerService, useValue: mockQueueProducerService },
        { provide: TransactionManagerService, useValue: mockTxManager },
        { provide: LogService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("ensureCustomer", () => {
    it("should create a new Stripe customer if one does not exist", async () => {
      mockUserService.findById.mockResolvedValue(mockUser);
      mockStripeService.createCustomer.mockResolvedValue({ id: "cus_new" });

      const customerId = await service.ensureCustomer(1);

      expect(customerId).toBe("cus_new");
      expect(mockStripeService.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({ email: mockUser.email }),
      );
      expect(mockUserService.saveUser).toHaveBeenCalledWith(
        expect.objectContaining({ stripeCustomerId: "cus_new" }),
      );
    });

    it("should return existing customer ID if it exists", async () => {
      mockUserService.findById.mockResolvedValue(mockUserWithId);

      const customerId = await service.ensureCustomer(1);

      expect(customerId).toBe("cus_123");
      expect(mockStripeService.createCustomer).not.toHaveBeenCalled();
      expect(mockUserService.saveUser).not.toHaveBeenCalled();
    });
  });

  describe("checkout", () => {
    it("should create and return a checkout session URL", async () => {
      // Mock para listPrices
      mockStripeService.listPrices.mockResolvedValue({
        data: [{ id: "price_123" }],
      });
      // Mock para ensureCustomer (que chama findById)
      mockUserService.findById.mockResolvedValue(mockUserWithId);
      // Mock para createCheckoutSession
      mockStripeService.createCheckoutSession.mockResolvedValue({
        id: "sess_123",
        url: "http://stripe.url",
      });

      const result = await service.checkout(1, "PRO");

      expect(result).toEqual({
        sessionId: "sess_123",
        url: "http://stripe.url",
      });
      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_123",
          success_url:
            "http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}",
          subscription_data: {
            metadata: { userId: "1", planKey: "PRO" },
          },
        }),
        expect.any(String), // Idempotency key
      );
    });

    it("should throw BadRequestException if price not found", async () => {
      mockStripeService.listPrices.mockResolvedValue({ data: [] }); // Nenhum preço encontrado

      await expect(service.checkout(1, "INVALID_KEY")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // Testando os Handlers de Webhook (privados)
  describe("Webhook Handlers", () => {
    it("handleCheckoutCompleted: should update PENDING sub to ACTIVE", async () => {
      mockStripeService.retrieveSubscription.mockResolvedValue(
        mockStripeSubscription,
      );
      mockPlanService.findByCode.mockResolvedValue(mockPlan);
      mockRepo.findLatestByUser.mockResolvedValue(mockPendingSub); // Acha a sub PENDING
      mockRepo.createOrUpdate.mockResolvedValue(mockActiveSub);
      mockUserService.findById.mockResolvedValue(mockUser); // Para o email

      await (service as any).handleCheckoutCompleted(mockStripeCheckoutSession);

      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockRepo.createOrUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionId: "sub_123",
          status: SubscriptionStatus.ACTIVE,
        }),
        mockEntityManager as unknown as EntityManager,
      );
      // Deve logar como UPDATE, pois achou uma PENDING
      expect(mockLogService.logUpdate).toHaveBeenCalled();
      expect(mockLogService.logCreate).not.toHaveBeenCalled();

      expect(mockQueueProducerService.sendEmailJob).toHaveBeenCalledWith(
        "sendWelcomeEmail",
        expect.any(Object),
      );
    });

    it("handlePaymentSucceeded: should update renewal dates and status", async () => {
      mockStripeService.retrieveSubscription.mockResolvedValue(
        mockStripeSubscription,
      );
      mockRepo.findByStripeId.mockResolvedValue(mockActiveSub); // Acha a sub ATIVA

      await (service as any).handlePaymentSucceeded(mockStripeInvoice);

      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockRepo.createOrUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionId: "sub_123",
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date(1700000000 * 1000), // Converte o timestamp
        }),
        mockEntityManager as unknown as EntityManager,
      );
      expect(mockLogService.logUpdate).toHaveBeenCalled();
      expect(mockQueueProducerService.sendEmailJob).toHaveBeenCalledWith(
        "sendPaymentSuccessEmail",
        expect.any(Object),
      );
    });

    it("handlePaymentFailed: should update status to PAST_DUE", async () => {
      mockRepo.findByStripeId.mockResolvedValue(mockActiveSub);

      await (service as any).handlePaymentFailed(mockStripeInvoice);

      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockRepo.createOrUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionId: "sub_123",
          status: SubscriptionStatus.PAST_DUE,
        }),
        mockEntityManager as unknown as EntityManager,
      );
      expect(mockLogService.logUpdate).toHaveBeenCalled();
      expect(mockQueueProducerService.sendEmailJob).toHaveBeenCalledWith(
        "sendPaymentFailedEmail",
        expect.any(Object),
      );
    });

    it("handleSubscriptionDeleted: should update status to INACTIVE", async () => {
      mockRepo.findByStripeId.mockResolvedValue(mockActiveSub);

      await (service as any).handleSubscriptionDeleted(mockStripeSubscription);

      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockRepo.createOrUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionId: "sub_123",
          status: SubscriptionStatus.INACTIVE,
        }),
        mockEntityManager as unknown as EntityManager,
      );
      expect(mockLogService.logUpdate).toHaveBeenCalled();
      expect(mockQueueProducerService.sendEmailJob).toHaveBeenCalledWith(
        "sendSubscriptionCanceledEmail",
        expect.any(Object),
      );
    });
  });
});
