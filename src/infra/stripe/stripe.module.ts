import { Module, Global } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import { StripeService } from "./stripe.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: Stripe,
      useFactory: (cfg: ConfigService) => {
        const s = cfg.get("stripe");
        return new Stripe(s.secretKey, { apiVersion: s.apiVersion });
      },
      inject: [ConfigService],
    },
    StripeService,
  ],
  exports: [StripeService, Stripe],
})
export class StripeModule {}
