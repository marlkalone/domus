import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MailModule } from "./infra/mail/mail.module";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { BillingModule } from "./modules/billing/billing.module";
import { TaxModule } from "./modules/tax/tax.module";
import { TransformInterceptor } from "./common/interceptors/response.interceptor";
import { AdminModule } from "./modules/admin/admin.module";
import { DatabaseModule } from "./infra/database/database.module";
import { AuthModule } from "./modules/auth/auth.module";
import { StripeModule } from "./infra/stripe/stripe.module";
import { UserModule } from "./modules/user/user.module";
import { seconds, ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AttachmentModule } from "./modules/attachment/attachment.module";
import awsConfig from "./config/aws.config";
import stripeConfig from "./config/stripe.config";
import mailConfig from "./config/mail.config";
import databaseConfig from "./config/database.config";
import { ContactModule } from "./modules/contact/contact.module";
import { AmenityModule } from "./modules/amenity/amenity.module";
import { ProjectModule } from "./modules/project/project.module";
import { SubscriptionModule } from "./modules/subscription/subscription.module";
import { TaskModule } from "./modules/task/task.module";
import { TransactionModule } from "./modules/transaction/transaction.module";
import { ErrorsModule } from "./common/filters/errors/errors.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import * as Joi from "joi";
import sqsConfig from "./config/sqs.config";
import { QueueModule } from "./infra/queue/queue.module";
import { Request } from "express";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { LogModule } from "./modules/log/log.module";
import { PermissionCacheModule } from "./modules/permission-cache/permission-cache.module";
import { CacheModule } from "@nestjs/cache-manager";

@Module({
  imports: [
    AttachmentModule,
    UserModule,
    AuthModule,
    TaxModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === "test" ? ".env.test" : ".env",
      load: [databaseConfig, awsConfig, stripeConfig, mailConfig, sqsConfig],
      validationSchema: Joi.object({
        // Banco de Dados
        DATABASE_PORT: Joi.number().default(5432),
        DATABASE_USER: Joi.string().required(),
        DATABASE_PASSWORD: Joi.string().required(),
        DATABASE_NAME: Joi.string().required(),
        DATABASE_URL: Joi.string().required(),

        // JWT
        JWT_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        JWT_RESET_SECRET: Joi.string().required(),

        // AWS
        AWS_REGION: Joi.string().required(),
        AWS_ACCESS_KEY_ID: Joi.string().required(),
        AWS_SECRET_ACCESS_KEY: Joi.string().required(),
        AWS_S3_BUCKET_NAME: Joi.string().required(),
        AWS_SQS_EMAIL_QUEUE_NAME: Joi.string().required(),
        AWS_SQS_EMAIL_QUEUE_URL: Joi.string().required(),
        AWS_SQS_STORAGE_QUEUE_NAME: Joi.string().required(),
        AWS_SQS_STORAGE_QUEUE_URL: Joi.string().required(),

        // Stripe
        STRIPE_SECRET_KEY: Joi.string().required(),
        STRIPE_WEBHOOK_SECRET: Joi.string().required(),

        // Outros
        NODE_ENV: Joi.string()
          .valid("development", "production", "test")
          .default("development"),
        PORT: Joi.number().default(4000),
        FRONTEND_URL: Joi.string().required(),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    BillingModule,
    MailModule,
    AdminModule,
    DatabaseModule,
    QueueModule,
    StripeModule,
    ContactModule,
    AmenityModule,
    ProjectModule,
    SubscriptionModule,
    TaskModule,
    TransactionModule,
    ThrottlerModule.forRoot(
      process.env.NODE_ENV === "test"
        ? { throttlers: [] }
        : {
            throttlers: [
              { name: "default", limit: 1000, ttl: seconds(60) },
              { name: "auth-register", limit: 3, ttl: seconds(3600) },
              { name: "auth-reset", limit: 3, ttl: seconds(3600) },
              { name: "admin", limit: 10, ttl: seconds(60) },
              { name: "billing", limit: 5, ttl: seconds(300) },
            ],
            skipIf: (context) => {
              const req = context.switchToHttp().getRequest<Request>();
              return req.path === "/api/v2/subscriptions/webhook";
            },
          },
    ),
    ErrorsModule,
    DashboardModule,
    LogModule,
    CacheModule.register({ isGlobal: true }),
    PermissionCacheModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
