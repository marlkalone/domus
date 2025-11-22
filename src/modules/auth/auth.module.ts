import {
  forwardRef,
  InternalServerErrorException,
  Module,
} from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { LocalStrategy } from "./strategies/local.strategy";
import { UserModule } from "../user/user.module";
import { JwtModule, JwtModuleOptions } from "@nestjs/jwt";
import { SubscriptionModule } from "../subscription/subscription.module";
import { MailModule } from "../../infra/mail/mail.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../../infra/database/entities/user.entity";
import { RefreshToken } from "../../infra/database/entities/refresh-token.entity";
import { JwtAccessStrategy } from "./strategies/jwt-access.strategy";
import { JwtRefreshStrategy } from "./strategies/jwt-refresh.strategy";
import { RefreshTokenRepository } from "./repository/refresh-token.repository";
import { ConfigService } from "@nestjs/config";
import { QueueModule } from "../../infra/queue/queue.module";

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => SubscriptionModule),
    MailModule,
    TypeOrmModule.forFeature([User, RefreshToken]),
    QueueModule,
    JwtModule.registerAsync({
      imports: [MailModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const jwtSecret = config.get("JWT_SECRET");
        if (!jwtSecret) {
          throw new InternalServerErrorException("JWT Secret not found!");
        }

        return {
          secret: jwtSecret,
          signOptions: { expiresIn: "1h" },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    RefreshTokenRepository,
  ],
  exports: [AuthService],
})
export class AuthModule {}
