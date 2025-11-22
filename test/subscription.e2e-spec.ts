import { INestApplication } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import request from "supertest";
import { setupE2eTest } from "./helpers/e2e-test.helper";
import { RegisterDTO } from "../src/modules/auth/dto/register.dto";
import { UserType } from "../src/common/enums/user.enum";
import { User } from "../src/infra/database/entities/user.entity";
import { Subscription } from "../src/infra/database/entities/subscription.entity";
import { SubscriptionStatus } from "../src/common/enums/subscription.enum";
import { StripeService } from "../src/infra/stripe/stripe.service";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Subscription E2E Flow", () => {
  let app: INestApplication;
  let httpServer: any;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let subRepo: Repository<Subscription>;

  const stripeServiceMock = {
    listPrices: jest.fn(),
    createCustomer: jest.fn(),
    createCheckoutSession: jest.fn(),
    retrieveSubscription: jest.fn(),
  };

  // DADOS DE TESTE
  const TEST_EMAIL = `sub-e2e-${Date.now()}@test.com`;
  const PASSWORD = "Password123!";
  let accessToken: string;
  let userId: number;

  const registerDto: RegisterDTO = {
    name: "Subscription User",
    email: TEST_EMAIL,
    password: PASSWORD,
    phone: "11999999999",
    document: "12345678900",
    type: UserType.INDIVIDUAL,
    address: {
      zipCode: "12345-000",
      street: "Rua Teste",
      number: "100",
      neighborhood: "Centro",
      city: "Testópolis",
      state: "TS",
    },
  };

  beforeAll(async () => {
    // Configura valores padrão para os mocks
    stripeServiceMock.listPrices.mockResolvedValue({
      data: [{ id: "price_mock_id", product: { name: "Pro Plan" } }],
    });
    stripeServiceMock.createCustomer.mockResolvedValue({ id: "cus_mock_123" });
    stripeServiceMock.createCheckoutSession.mockResolvedValue({
      id: "sess_mock_123",
      url: "https://checkout.stripe.com/mock-url",
    });

    const setup = await setupE2eTest((builder) => {
      return builder
        .overrideProvider(StripeService)
        .useValue(stripeServiceMock);
    });

    app = setup.app;
    httpServer = setup.httpServer;
    dataSource = setup.dataSource;
    userRepo = dataSource.getRepository(User);
    subRepo = dataSource.getRepository(Subscription);

    // 1. Preparar Usuário
    await request(httpServer).post("/api/v2/auth/register").send(registerDto);

    const user = await userRepo.findOneBy({ email: TEST_EMAIL });
    userId = user!.id;

    // Força verificação
    await userRepo.update({ id: userId }, { emailVerified: true });

    const loginRes = await request(httpServer)
      .post("/api/v2/auth/login")
      .send({ email: TEST_EMAIL, password: PASSWORD });

    accessToken = loginRes.body.data.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it("should create a CHECKOUT SESSION", async () => {
    const planCode = "PRO";

    const res = await request(httpServer)
      .post(`/api/v2/subscriptions/checkout/${planCode}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);

    expect(res.body.data.sessionId).toBe("sess_mock_123");
    expect(res.body.data.url).toBeDefined();

    expect(stripeServiceMock.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: expect.stringContaining(
          "session_id={CHECKOUT_SESSION_ID}",
        ),
        subscription_data: expect.objectContaining({
          metadata: { userId: String(userId), planKey: planCode },
        }),
      }),
      expect.stringContaining(`checkout_${userId}_${planCode}`),
    );
  });

  it("should activate subscription via WEBHOOK (checkout.session.completed)", async () => {
    const stripeSubId = "sub_stripe_new_123";

    // Configura o mock para quando o service chamar retrieveSubscription
    stripeServiceMock.retrieveSubscription.mockResolvedValue({
      id: stripeSubId,
      status: "active",
      metadata: { userId: String(userId), planKey: "PRO" },
      items: {
        data: [
          {
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
          },
        ],
      },
    });

    // Payload do Webhook - Exatamente como o Stripe envia
    const webhookPayload = {
      id: "evt_test_webhook",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "sess_mock_123",
          object: "checkout.session",
          subscription: stripeSubId,
          metadata: { userId: String(userId), planKey: "PRO" },
          customer: "cus_mock_123",
        },
      },
    };

    const res = await request(httpServer)
      .post("/api/v2/subscriptions/webhook")
      .set("stripe-signature", "dummy_signature")
      .send(webhookPayload);

    // Debug: Se der 400, mostre o erro
    if (res.status !== 200) {
      console.error(
        "Webhook Error Response:",
        JSON.stringify(res.body, null, 2),
      );
    }
    expect(res.status).toBe(200);

    // Aumentamos o tempo de espera para garantir persistência
    await sleep(2000);

    // Verificação
    const activeSub = await subRepo.findOne({
      where: { user: { id: userId }, status: SubscriptionStatus.ACTIVE },
      relations: ["plan"],
    });

    if (!activeSub) {
      console.error("Debug: Assinatura não encontrada no DB.");
      const allSubs = await subRepo.find({ where: { user: { id: userId } } });
      console.log("Todas as assinaturas do usuário:", allSubs);
    }

    expect(activeSub).toBeDefined();
    expect(activeSub!.plan.code).toBe("PRO");
    expect(activeSub!.stripeSubscriptionId).toBe(stripeSubId);
  });

  it("should mark subscription as PAST_DUE via WEBHOOK (invoice.payment_failed)", async () => {
    let sub = await subRepo.findOneBy({
      user: { id: userId },
      status: SubscriptionStatus.ACTIVE,
    });

    if (!sub) {
      // Fallback seguro
      const user = await userRepo.findOneBy({ id: userId });
      const newSub = subRepo.create({
        user: user!,
        status: SubscriptionStatus.ACTIVE,
        stripeSubscriptionId: "sub_forced_123",
        plan: { id: 2 } as any, // Assumindo ID 2 para PRO baseado no seed
      });
      sub = await subRepo.save(newSub);
    }

    const currentSubId = sub!.stripeSubscriptionId;

    stripeServiceMock.retrieveSubscription.mockResolvedValue({
      id: currentSubId,
      status: "past_due",
      metadata: { userId: String(userId), planKey: "PRO" },
    });

    const webhookPayload = {
      id: "evt_test_invoice_failed",
      object: "event",
      type: "invoice.payment_failed",
      data: {
        object: {
          subscription: currentSubId,
          amount_due: 9990,
          attempt_count: 1,
          metadata: { userId: String(userId), planKey: "PRO" },
        },
      },
    };

    const res = await request(httpServer)
      .post("/api/v2/subscriptions/webhook")
      .set("stripe-signature", "dummy_signature")
      .send(webhookPayload);

    expect(res.status).toBe(200);

    await sleep(1000);

    const updatedSub = await subRepo.findOneBy({ id: sub!.id });
    expect(updatedSub).toBeDefined();
    expect(updatedSub!.status).toBe(SubscriptionStatus.PAST_DUE);
  });
});
