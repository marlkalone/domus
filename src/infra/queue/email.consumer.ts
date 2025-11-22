import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { SqsMessageHandler, SqsConsumerEventHandler } from "@ssut/nestjs-sqs";
import { MailService } from "../mail/mail.service";
import * as AWS from "@aws-sdk/client-sqs";
import { ConfigService } from "@nestjs/config";

export const EMAIL_CONSUMER_NAME = "email-consumer";

@Injectable()
export class EmailConsumer {
  private readonly frontendUrl: string;

  constructor(
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {
    const url = this.configService.get<string>("FRONTEND_URL");
    if (!url) {
      throw new InternalServerErrorException("FRONTEND_URL is not configured");
    }
    this.frontendUrl = url;
  }

  @SqsMessageHandler(EMAIL_CONSUMER_NAME, false)
  async handleMessage(message: AWS.Message) {
    try {
      const jobName = message.MessageAttributes?.JobName?.StringValue;
      if (!jobName) {
        console.warn(
          `[SQS Consumer] Message ${message.MessageId} has no JobName attribute.`,
        );
        return;
      }

      if (!message.Body) {
        console.warn(
          `[SQS Consumer] Message ${message.MessageId} has no body.`,
        );
        return;
      }

      const payload = JSON.parse(message.Body);
      console.log(`[SQS Consumer] Processing job: ${jobName}`);

      if (jobName === "sendVerification") {
        await this.handleSendVerification(payload);
      } else if (jobName === "sendPasswordReset") {
        await this.handleSendPasswordReset(payload);
      } else if (jobName === "sendWelcomeEmail") {
        await this.handleWelcomeEmail(payload);
      } else if (jobName === "sendPaymentSuccessEmail") {
        await this.handlePaymentSuccess(payload);
      } else if (jobName === "sendPaymentFailedEmail") {
        await this.handlePaymentFailed(payload);
      } else if (jobName === "sendSubscriptionCanceledEmail") {
        await this.handleSubscriptionCanceled(payload);
      } else {
        console.warn(`[SQS Consumer] Unknown job name: ${jobName}`);
      }
    } catch (error) {
      console.error(
        `[SQS Consumer] Error processing message ${message.MessageId}:`,
        error,
      );
      throw error;
    }
  }

  private async handleSendVerification(payload: {
    userId: number;
    token: string;
    email: string;
    name: string;
  }) {
    const verificationUrl = `${this.frontendUrl}/auth/verify-email?token=${payload.token}`;

    await this.mailService.sendVerificationEmail(
      payload.email,
      payload.name,
      verificationUrl,
    );
  }

  private async handleSendPasswordReset(payload: {
    email: string;
    token: string;
  }) {
    const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${payload.token}`;

    await this.mailService.sendPasswordResetEmail(payload.email, resetUrl);
  }

  private async handleWelcomeEmail(payload: {
    email: string;
    name: string;
    planName: string;
  }) {
    await this.mailService.sendWelcomePlanEmail(
      payload.email,
      payload.name,
      payload.planName,
    );
  }

  private async handlePaymentSuccess(payload: {
    email: string;
    name: string;
    planName: string;
    amount: string;
  }) {
    await this.mailService.sendPaymentSuccessEmail(
      payload.email,
      payload.name,
      payload.planName,
      payload.amount,
    );
  }

  private async handlePaymentFailed(payload: { email: string; name: string }) {
    const portalUrl = `${this.frontendUrl}/billing`;
    await this.mailService.sendPaymentFailedEmail(
      payload.email,
      payload.name,
      portalUrl,
    );
  }

  private async handleSubscriptionCanceled(payload: {
    email: string;
    name: string;
  }) {
    await this.mailService.sendSubscriptionCanceledEmail(
      payload.email,
      payload.name,
    );
  }

  @SqsConsumerEventHandler(EMAIL_CONSUMER_NAME, "processing_error")
  onProcessingError(error: Error, message: AWS.Message) {
    console.error(
      `[SQS Consumer] SQS onProcessingError for message ${message.MessageId}:`,
      error,
    );
  }

  @SqsConsumerEventHandler(EMAIL_CONSUMER_NAME, "error")
  onError(error: Error, message: AWS.Message) {
    console.error(
      `[SQS Consumer] SQS onError for message ${message.MessageId}:`,
      error,
    );
  }
}
