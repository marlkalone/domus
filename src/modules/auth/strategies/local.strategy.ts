import { Strategy } from "passport-local";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../auth.service";
import { LoginDto } from "../dto/login.dto";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private auth: AuthService) {
    super({ usernameField: "email" });
  }

  async validate(email: string, password: string) {
    const result = await this.auth.login({ email, password } as LoginDto);
    if (!result) throw new UnauthorizedException();
    return result;
  }
}
