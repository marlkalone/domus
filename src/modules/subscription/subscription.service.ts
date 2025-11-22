import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { SubscriptionRepository } from "./repository/subscription.repository";
import Stripe from "stripe";
import { StripeService } from "../../infra/stripe/stripe.service";
import { SubscriptionStatus } from "../../common/enums/subscription.enum";
import { Subscription } from "../../infra/database/entities/subscription.entity";
import { UserService } from "../user/user.service";
import { ConfigService } from "@nestjs/config";
import { QueueProducerService } from "../../infra/queue/queue.producer.service";
import { PlanService } from "./plan.service";
import { TransactionManagerService } from "../../infra/database/transaction-manager.service";
import { LogService } from "../log/log.service";
import { EntityManager } from "typeorm";

@Injectable()
export class SubscriptionService {
  private readonly frontendUrl: string;

  constructor(
    private readonly stripe: StripeService,
    private readonly repo: SubscriptionRepository,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly planService: PlanService,
    private readonly configService: ConfigService,
    private readonly queueProducerService: QueueProducerService,
    private readonly txManager: TransactionManagerService,
    private readonly logService: LogService,
  ) {
    const url = this.configService.get<string>("FRONTEND_URL");
    if (!url) {
      throw new InternalServerErrorException("FRONTEND_URL is not configured");
    }
    this.frontendUrl = url;
  }

  // ===================================================================
  // ORQUESTRADOR DE WEBHOOK
  // ===================================================================

  async handleWebhookEvent(event: Stripe.Event) {
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case "invoice.payment_succeeded":
        await this.handlePaymentSucceeded(event.data.object as any);
        break;

      case "invoice.payment_failed":
        await this.handlePaymentFailed(event.data.object as any);
        break;

      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }
  }

  // ===================================================================
  // HANDLERS DE LÓGICA DE NEGÓCIOS (Métodos Privados)
  // ===================================================================

  //Chamado quando um usuário completa o checkout pela primeira vez.
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (!session.subscription) {
      console.error(
        "Stripe Webhook Error: checkout.session.completed missing session.subscription",
      );
      throw new BadRequestException(
        "Missing subscription data in checkout session",
      );
    }

    const stripeSub = await this.stripe.retrieveSubscription(
      session.subscription as string,
    );

    if (
      !stripeSub.metadata ||
      !stripeSub.metadata.planKey ||
      !stripeSub.metadata.userId
    ) {
      console.error(
        "Stripe Webhook Error: Subscription metadata missing planKey or userId",
        stripeSub,
      );
      throw new BadRequestException("Missing metadata in subscription");
    }

    const planKey = (stripeSub.metadata.planKey as string).toUpperCase();
    const userId = +stripeSub.metadata.userId;
    const plan = await this.planService.findByCode(planKey);
    const item = stripeSub.items.data[0];

    await this.txManager.run(async (manager: EntityManager) => {
      const dto = {
        user: { id: userId },
        plan: plan,
        stripeSubscriptionId: stripeSub.id,
        status: this.mapStripeStatus(stripeSub.status),
        startDate: new Date(item.current_period_start * 1000),
        endDate: new Date(item.current_period_end * 1000),
      } as Partial<Subscription>;

      const beforeSub = await this.repo.findLatestByUser(userId, manager);

      const updatedSub = await this.repo.createOrUpdate(dto, manager);

      // Loga a alteração
      if (beforeSub && beforeSub.status === SubscriptionStatus.PENDING) {
        await this.logService.logUpdate(
          manager,
          userId,
          "Subscription",
          beforeSub,
          {
            status: updatedSub.status,
            plan: updatedSub.plan,
            stripeSubscriptionId: updatedSub.stripeSubscriptionId,
            startDate: updatedSub.startDate,
            endDate: updatedSub.endDate,
          },
        );
      } else {
        await this.logService.logCreate(
          manager,
          userId,
          "Subscription",
          updatedSub,
        );
      }
    });

    try {
      const user = await this.userService.findById(userId);
      if (user) {
        await this.queueProducerService.sendEmailJob("sendWelcomeEmail", {
          email: user.email,
          name: user.name,
          planName: plan.name,
        });
      }
    } catch (err) {
      console.error("Failed to send welcome email job:", err);
    }
  }

  //Chamado quando uma assinatura é atualizada.
  private async handleSubscriptionUpdated(sub: Stripe.Subscription) {
    const localSub = await this.repo.findByStripeId(sub.id, ["user", "plan"]);

    if (!localSub) {
      await this.repo.createOrUpdate({
        stripeSubscriptionId: sub.id,
        status: this.mapStripeStatus(sub.status),
      } as Subscription);
      return;
    }

    const userId = localSub.user.id;
    const newStatus = this.mapStripeStatus(sub.status);

    await this.txManager.run(async (manager: EntityManager) => {
      await this.logService.logUpdate(
        manager,
        userId,
        "Subscription",
        localSub,
        {
          status: newStatus,
        },
      );

      localSub.status = newStatus;
      await this.repo.createOrUpdate(localSub, manager);
    });
  }

  //Chamado quando um pagamento de renovação é bem-sucedido.
  private async handlePaymentSucceeded(invoice: any) {
    const subscriptionId: string = invoice.subscription;
    if (!subscriptionId) {
      console.log("Skipping invoice.payment_succeeded for initial payment.");
      return;
    }

    const sub = await this.stripe.retrieveSubscription(subscriptionId);
    const localSub = await this.repo.findByStripeId(sub.id, ["user", "plan"]);

    if (!localSub || !localSub.user || !localSub.plan) {
      await this.repo.createOrUpdate({
        stripeSubscriptionId: sub.id,
        status: this.mapStripeStatus(sub.status),
        startDate: new Date(sub.items.data[0].current_period_start * 1000),
        endDate: new Date(sub.items.data[0].current_period_end * 1000),
      } as any);
      return;
    }

    const userId = localSub.user.id;
    const newStatus = this.mapStripeStatus(sub.status);
    const newStartDate = new Date(
      sub.items.data[0].current_period_start * 1000,
    );
    const newEndDate = new Date(sub.items.data[0].current_period_end * 1000);

    await this.txManager.run(async (manager: EntityManager) => {
      await this.logService.logUpdate(
        manager,
        userId,
        "Subscription",
        localSub,
        {
          status: newStatus,
          startDate: newStartDate,
          endDate: newEndDate,
        },
      );

      await this.repo.createOrUpdate(
        {
          stripeSubscriptionId: sub.id,
          status: newStatus,
          startDate: newStartDate,
          endDate: newEndDate,
        } as any,
        manager,
      );
    });

    try {
      const amount = (invoice.amount_paid / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      await this.queueProducerService.sendEmailJob("sendPaymentSuccessEmail", {
        email: localSub.user.email,
        name: localSub.user.name,
        planName: localSub.plan.name,
        amount: amount,
      });
    } catch (err) {
      console.error("Failed to send payment success email job:", err);
    }
  }

  //Chamado quando um pagamento de renovação falha.
  private async handlePaymentFailed(invoice: any) {
    const subscriptionId: string =
      invoice.subscription || invoice.subscriptionId;
    if (!subscriptionId) {
      throw new BadRequestException("Invoice webhook missing subscription ID");
    }

    const localSub = await this.repo.findByStripeId(subscriptionId, ["user"]);

    if (!localSub || !localSub.user) {
      await this.repo.createOrUpdate({
        stripeSubscriptionId: subscriptionId,
        status: SubscriptionStatus.PAST_DUE,
      });
      return;
    }

    const userId = localSub.user.id;

    await this.txManager.run(async (manager: EntityManager) => {
      await this.logService.logUpdate(
        manager,
        userId,
        "Subscription",
        localSub,
        {
          status: SubscriptionStatus.PAST_DUE,
        },
      );

      await this.repo.createOrUpdate(
        {
          stripeSubscriptionId: subscriptionId,
          status: SubscriptionStatus.PAST_DUE,
        } as any,
        manager,
      );
    });

    try {
      await this.queueProducerService.sendEmailJob("sendPaymentFailedEmail", {
        email: localSub.user.email,
        name: localSub.user.name,
      });
    } catch (err) {
      console.error("Failed to send payment failed email job:", err);
    }
  }

  //Chamado quando uma assinatura é cancelada (pelo usuário ou Stripe).
  private async handleSubscriptionDeleted(sub: Stripe.Subscription) {
    const localSub = await this.repo.findByStripeId(sub.id, ["user"]);

    if (!localSub || !localSub.user) {
      await this.repo.createOrUpdate({
        stripeSubscriptionId: sub.id,
        status: SubscriptionStatus.INACTIVE,
      } as any);
      return;
    }

    const userId = localSub.user.id;

    await this.txManager.run(async (manager: EntityManager) => {
      await this.logService.logUpdate(
        manager,
        userId,
        "Subscription",
        localSub,
        {
          status: SubscriptionStatus.INACTIVE,
        },
      );

      await this.repo.createOrUpdate(
        {
          stripeSubscriptionId: sub.id,
          status: SubscriptionStatus.INACTIVE,
        } as any,
        manager,
      );
    });

    try {
      await this.queueProducerService.sendEmailJob(
        "sendSubscriptionCanceledEmail",
        {
          email: localSub.user.email,
          name: localSub.user.name,
        },
      );
    } catch (err) {
      console.error("Failed to send subscription canceled email job:", err);
    }
  }

  // ===================================================================
  // MÉTODOS PÚBLICOS (Controlador e outros Serviços)
  // ===================================================================

  async checkout(userId: number, lookupKey: string) {
    const prices = await this.stripe.listPrices({
      lookup_keys: [lookupKey],
      expand: ["data.product"],
    });

    if (prices.data.length !== 1)
      throw new BadRequestException("Preço não encontrado");

    const customer = await this.ensureCustomer(userId);

    const session = await this.stripe.createCheckoutSession(
      {
        customer,
        mode: "subscription",
        line_items: [{ price: prices.data[0].id, quantity: 1 }],
        subscription_data: {
          metadata: { userId: String(userId), planKey: lookupKey },
        },
        success_url: `${this.frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.frontendUrl}/cancel`,
      },
      `checkout_${userId}_${lookupKey}`,
    );

    return { sessionId: session.id, url: session.url };
  }

  async ensureCustomer(userId: number): Promise<string> {
    const user = await this.userService.findById(userId);

    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.stripe.createCustomer({
      email: user.email,
      name: user.name,
      metadata: { userId: `${user.id}` },
    });

    user.stripeCustomerId = customer.id;
    await this.userService.saveUser(user);

    return customer.id;
  }

  async getUserPlan(userId: number): Promise<string | null> {
    const sub = await this.repo.findLatestByUser(userId);
    return sub?.plan.code ?? null;
  }

  async getUserStatus(userId: number): Promise<SubscriptionStatus | null> {
    const sub = await this.repo.findLatestByUser(userId);
    if (!sub) return null;
    return sub.status as SubscriptionStatus;
  }

  // ===================================================================
  // MÉTODOS PARA ADMIN
  // ===================================================================

  async adminFindAllByStatus(
    status: SubscriptionStatus,
    skip: number,
    limit: number,
  ): Promise<[Subscription[], number]> {
    return this.repo.findByStatus(status, skip, limit);
  }

  //(Admin) Busca estatísticas de subscrição agregadas.
  async adminGetActiveSubscriptionStats(): Promise<{
    totalActive: number;
    totalRevenue: number;
  }> {
    return this.repo.getActiveSubscriptionStats();
  }

  //(Admin) Busca receita mensal agrupada por plano.
  async adminGetMonthlyRevenueByPlan(
    start: Date,
    end: Date,
  ): Promise<{ planName: string; month: string; revenue: number }[]> {
    return this.repo.getMonthlyRevenueByPlan(start, end);
  }

  // ===================================================================
  // MÉTODOS PRIVADOS
  // ===================================================================

  private mapStripeStatus(
    status: Stripe.Subscription.Status,
  ): SubscriptionStatus {
    switch (status) {
      case "active":
        return SubscriptionStatus.ACTIVE;
      case "past_due":
        return SubscriptionStatus.PAST_DUE;
      case "canceled":
      case "unpaid":
        return SubscriptionStatus.INACTIVE;
      default:
        return SubscriptionStatus.PENDING;
    }
  }
}
