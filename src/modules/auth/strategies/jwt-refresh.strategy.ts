import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-jwt";
import { AuthService } from "../auth.service";
import { ConfigService } from "@nestjs/config";
import { PayloadDTO } from "../dto/payload.dto";

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh",
) {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    const secretOrKey = config.get<string>("JWT_REFRESH_SECRET");
    if (!secretOrKey) {
      throw new InternalServerErrorException(
        "JWT Refresh Secret is not defined!",
      );
    }

    super({
      jwtFromRequest: (req) =>
        req?.body?.refreshToken || req?.headers["x-refresh-token"],
      secretOrKey: secretOrKey,
      ignoreExpiration: false,
    });
  }

  async validate(payload: PayloadDTO) {
    const userData = await this.authService.validateUser(payload);

    if (!userData) throw new UnauthorizedException("Refresh token inválido");
    return userData;
  }
}
