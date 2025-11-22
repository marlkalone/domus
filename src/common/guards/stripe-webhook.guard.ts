import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import Stripe from "stripe";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class StripeWebhookGuard implements CanActivate {
  constructor(
    private readonly stripe: Stripe,
    private readonly config: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const sig = req.headers["stripe-signature"];
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!secret) {
      throw new InternalServerErrorException(
        "Stripe webhook secret is not configured",
      );
    }

    try {
      req.event = this.stripe.webhooks.constructEvent(req.rawBody, sig, secret);

      return true;
    } catch (err) {
      throw new BadRequestException("Webhook signature inválida");
    }
  }
}
