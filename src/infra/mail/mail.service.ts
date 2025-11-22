import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SendTemplatedEmailCommand, SESClient } from "@aws-sdk/client-ses";

@Injectable()
export class MailService {
  private readonly fromEmail: string;

  constructor(
    private readonly sesClient: SESClient,
    private readonly configService: ConfigService,
  ) {
    const from = configService.get<string>("DEFAULT_EMAIL_FROM");
    if (!from) throw new Error("mail.fromEmail is not configured");
    this.fromEmail = from;
  }

  /**
   * Método genérico para enviar e-mails baseados em template
   * Os templates devem ser criados direto no painel do SES na AWS
   */
  private async sendTemplatedEmail(
    to: string,
    templateName: string,
    templateData: Record<string, any>,
  ): Promise<boolean> {
    const templateDataString = JSON.stringify(templateData);

    const command = new SendTemplatedEmailCommand({
      Source: this.fromEmail,
      Destination: { ToAddresses: [to] },
      Template: templateName,
      TemplateData: templateDataString,
    });

    try {
      await this.sesClient.send(command);
      return true;
    } catch (err) {
      console.error(
        `[MailService] Failed to send template email ${templateName} to ${to}:`,
        err,
      );
      return false;
    }
  }

  async sendVerificationEmail(
    email: string,
    name: string,
    verificationUrl: string,
  ) {
    await this.sendTemplatedEmail(email, "domus-verification", {
      name,
      verificationUrl,
    });
  }

  async sendPasswordResetEmail(email: string, resetUrl: string) {
    await this.sendTemplatedEmail(email, "domus-reset-password", {
      resetUrl,
    });
  }

  async sendWelcomePlanEmail(email: string, name: string, planName: string) {
    await this.sendTemplatedEmail(email, "domus-welcome-plan", {
      name,
      planName,
    });
  }

  async sendPaymentSuccessEmail(
    email: string,
    name: string,
    planName: string,
    amount: string,
  ) {
    await this.sendTemplatedEmail(email, "domus-payment-success", {
      name,
      planName,
      amount,
    });
  }

  async sendPaymentFailedEmail(email: string, name: string, portalUrl: string) {
    await this.sendTemplatedEmail(email, "domus-payment-failed", {
      name,
      portalUrl,
    });
  }

  async sendSubscriptionCanceledEmail(email: string, name: string) {
    await this.sendTemplatedEmail(email, "domus-subscription-canceled", {
      name,
    });
  }
}
