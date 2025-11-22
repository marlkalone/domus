import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { UserService } from "../user/user.service";
import { SubscriptionService } from "../subscription/subscription.service";
import { RegisterDTO } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenRepository } from "./repository/refresh-token.repository";
import { ConfigService } from "@nestjs/config";
import { User } from "../../infra/database/entities/user.entity";
import { QueueProducerService } from "../../infra/queue/queue.producer.service";
import { plainToInstance } from "class-transformer";
import { LoginResponseDTO } from "./dto/login-response.dto";
import { PayloadDTO } from "./dto/payload.dto";
import { UserDataDTO } from "./dto/user-data.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly userService: UserService,
    private readonly subService: SubscriptionService,
    private readonly rtRepo: RefreshTokenRepository,
    private readonly jwt: JwtService,
    private readonly queueProducerService: QueueProducerService,
  ) {}

  async register(dto: RegisterDTO): Promise<void> {
    const user = await this.userService.create({ ...dto });

    const token = this.jwt.sign(
      { sub: user.id, email: user.email },
      { expiresIn: "24h" },
    );

    await this.queueProducerService.sendEmailJob("sendVerification", {
      userId: user.id,
      token,
      email: user.email,
      name: user.name,
    });
  }

  async verifyEmail(token: string) {
    let payload: any;

    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException(
        "Token de verificação inválido ou expirado",
      );
    }

    await this.userService.markEmailVerified(payload.sub);

    return true;
  }

  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);

    if (!user) throw new UnauthorizedException("Invalid credentials");

    if (!user.emailVerified)
      throw new UnauthorizedException("Email not verified");

    if (!(await bcrypt.compare(dto.password, user.passwordHash)))
      throw new UnauthorizedException("Invalid credentials");

    return await this.generateTokens(user);
  }

  async refresh(rtDto: { refreshToken: string }) {
    let payload: any;

    try {
      payload = this.jwt.verify(rtDto.refreshToken, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid/expired refresh token!");
    }

    const tokens = await this.rtRepo.findValidByUser(payload.sub);

    let match = null;
    for (const t of tokens) {
      console.log(`––> comparando com hash id=${t.id}:`, t.tokenHash);
      const isMatch = await bcrypt.compare(rtDto.refreshToken, t.tokenHash);
      console.log(`   → resultado bcrypt.compare para id=${t.id}:`, isMatch);
      if (isMatch) {
        match = t;
        break;
      }
    }

    if (!match) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.rtRepo.remove(match);

    const user = await this.userService.findById(payload.sub);

    return this.generateTokens(user);
  }

  async logout(userId: number, rt?: string) {
    if (rt) {
      await this.rtRepo.removeByToken(userId, rt);
    } else {
      await this.rtRepo.removeAllByUser(userId);
    }

    return true;
  }

  async requestPasswordReset(email: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) return;

    const token = this.jwt.sign(
      { sub: user.id, reset: true },
      { secret: this.config.get<string>("JWT_RESET_SECRET"), expiresIn: "1h" },
    );

    await this.queueProducerService.sendEmailJob("sendPasswordReset", {
      email: user.email,
      token,
    });
  }

  async resetPassword(dto: { token: string; newPassword: string }) {
    let payload: any;

    try {
      payload = this.jwt.verify(dto.token, {
        secret: this.config.get<string>("JWT_RESET_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Token inválido ou expirado");
    }

    if (!payload.reset) throw new UnauthorizedException("Token inválido");

    const user = await this.userService.findById(payload.sub);
    if (!user) throw new NotFoundException("Usuário não encontrado");

    await this.userService.updatePassword({
      user_id: user.id,
      password: dto.newPassword,
      version: user.version,
    });
  }

  async validateUser(payload: PayloadDTO): Promise<UserDataDTO> {
    const user = await this.userService.findById(payload.sub);

    if (!user.emailVerified) {
      throw new UnauthorizedException("E-mail not verified!");
    }

    const userPlan = await this.subService.getUserPlan(user.id);
    if (!userPlan) throw new UnauthorizedException("User plan not found!");

    const userStatus = await this.subService.getUserStatus(user.id);
    if (!userStatus) throw new UnauthorizedException("User status not find!");

    return plainToInstance(UserDataDTO, {
      id: user.id,
      email: user.email,
      role: user.role,
      plan: userPlan,
      status: userStatus,
    });
  }

  private async generateTokens(user: User): Promise<LoginResponseDTO> {
    const plan = await this.subService.getUserPlan(user.id);
    const status = await this.subService.getUserStatus(user.id);

    if (!plan)
      throw new InternalServerErrorException(
        `Plan not found for user ${user.id}`,
      );
    if (!status)
      throw new InternalServerErrorException(
        `Status not found for user ${user.id}`,
      );
    if (!user.subscriptions || user.subscriptions.length == 0) {
      throw new InternalServerErrorException(
        `Subscription not found for user ${user.id}`,
      );
    }

    const payload: PayloadDTO = {
      sub: user.id,
      email: user.email,
      role: user.role,
      plan,
      status,
      subscription_id: user.subscriptions[0].id,
    };

    const access_token = this.jwt.sign(payload, { expiresIn: "1h" });
    const refresh_token = await this.jwt.signAsync(payload, {
      secret: this.config.get("JWT_REFRESH_SECRET"),
      expiresIn: "7d",
    });

    const tokenHash = await bcrypt.hash(refresh_token, 10);
    const expiresAt = new Date(Date.now() + 7 * 86400 * 1000);
    await this.rtRepo.createToken(user, tokenHash, expiresAt);

    return plainToInstance(
      LoginResponseDTO,
      { access_token, refresh_token, user, plan, status },
      { excludeExtraneousValues: true },
    );
  }
}
