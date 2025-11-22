import { Injectable } from "@nestjs/common";
import Stripe from "stripe";

@Injectable()
export class StripeService {
  constructor(private readonly stripe: Stripe) {}

  createCustomer(data: Stripe.CustomerCreateParams) {
    return this.stripe.customers.create(data);
  }

  retrieveCustomer(id: string) {
    return this.stripe.customers.retrieve(id);
  }

  createCheckoutSession(
    data: Stripe.Checkout.SessionCreateParams,
    key: string,
  ) {
    return this.stripe.checkout.sessions.create(data, {
      idempotencyKey: `checkout_${key}`,
    });
  }

  retrieveCheckoutSession(id: string) {
    return this.stripe.checkout.sessions.retrieve(id);
  }

  createPortalSession(data: Stripe.BillingPortal.SessionCreateParams) {
    return this.stripe.billingPortal.sessions.create(data);
  }

  retrieveSubscription(id: string) {
    return this.stripe.subscriptions.retrieve(id);
  }

  listPrices(params: Stripe.PriceListParams) {
    return this.stripe.prices.list(params);
  }

  constructEvent(
    payload: Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }
}
