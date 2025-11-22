import { forwardRef, Module } from "@nestjs/common";
import { SubscriptionController } from "./subscription.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Subscription } from "../../infra/database/entities/subscription.entity";
import { SubscriptionRepository } from "./repository/subscription.repository";
import { StripeModule } from "../../infra/stripe/stripe.module";
import { SubscriptionService } from "./subscription.service";
import { UserModule } from "../user/user.module";
import { Plan } from "../../infra/database/entities/plan.entity";
import { PlanRepository } from "./repository/plan.repository";
import { StripeWebhookGuard } from "../../common/guards/stripe-webhook.guard";
import { PlanService } from "./plan.service";
import { DatabaseModule } from "../../infra/database/database.module";
import { PlanGuardModule } from "../../common/guards/plan-guard.module";
import { QueueModule } from "../../infra/queue/queue.module";
import { LogModule } from "../log/log.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Plan]),
    forwardRef(() => UserModule),
    StripeModule,
    DatabaseModule,
    PlanGuardModule,
    QueueModule,
    LogModule,
  ],
  providers: [
    SubscriptionRepository,
    PlanRepository,
    SubscriptionService,
    StripeWebhookGuard,
    PlanService,
  ],
  controllers: [SubscriptionController],
  exports: [SubscriptionService, PlanService],
})
export class SubscriptionModule {}
