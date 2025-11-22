import { Controller, Post, UseGuards, Req, Res, Param } from "@nestjs/common";
import { SubscriptionService } from "./subscription.service";
import { StripeWebhookGuard } from "../../common/guards/stripe-webhook.guard";
import Stripe from "stripe";
import { Request, Response } from "express";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Role } from "../../common/enums/user.enum";
import { Public } from "../../common/decorators/public.decorator";
import { UserId } from "../../common/decorators/user-id.decorator";
import { SkipThrottle } from "@nestjs/throttler";
import { ApiOperation } from "@nestjs/swagger";

@Controller("subscriptions")
export class SubscriptionController {
  constructor(private readonly svc: SubscriptionService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  @Post("checkout/:lookupKey")
  @ApiOperation({ summary: "Create a checkout session" })
  async checkout(
    @Param("lookupKey") lookupKey: string,
    @UserId() userId: number,
  ) {
    return this.svc.checkout(userId, lookupKey);
  }

  @Public()
  @SkipThrottle()
  @Post("webhook")
  @UseGuards(StripeWebhookGuard)
  @ApiOperation({ summary: "Stripe webhooks" })
  async webhook(@Req() req: Request, @Res() res: Response) {
    const event = (req as any).event as Stripe.Event;
    await this.svc.handleWebhookEvent(event);
    res.sendStatus(200);
  }
}
