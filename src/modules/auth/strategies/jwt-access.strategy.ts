import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Role } from "../../../common/enums/user.enum";
import { SubscriptionStatus } from "../../../common/enums/subscription.enum";
import { ConfigService } from "@nestjs/config";
import { PayloadDTO } from "../dto/payload.dto";

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(private readonly configService: ConfigService) {
    const secretOrKey = configService.get<string>("JWT_SECRET");
    if (!secretOrKey) {
      throw new InternalServerErrorException("JWT Secret is not defined!");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secretOrKey,
      ignoreExpiration: false,
    });
  }

  async validate(payload: PayloadDTO) {
    return payload;
  }
}
