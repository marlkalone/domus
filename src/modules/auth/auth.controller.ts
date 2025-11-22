import { Controller, Post, Body, UseGuards, Request } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDTO } from "./dto/register.dto";
import { EmailVerificationDTO } from "./dto/email-verification.dto";
import { RefreshTokenDTO } from "./dto/refresh-token.dto";
import { ResetPasswordDTO } from "./dto/reset-password.dto";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/user.enum";
import { Public } from "../../common/decorators/public.decorator";
import { Request as Req } from "express";
import { ApiOperation } from "@nestjs/swagger";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ "auth-register": { limit: 3, ttl: 3600_000 } })
  @ApiOperation({ summary: "Register a new user" })
  @Post("register")
  async register(@Body() dto: RegisterDTO) {
    await this.auth.register(dto);
    return { message: "Registro realizado! Verifique seu e-mail." };
  }

  @Public()
  @Post("verify-email")
  @ApiOperation({ summary: "Verify user email" })
  async verifyEmail(@Body() dto: EmailVerificationDTO) {
    await this.auth.verifyEmail(dto.token);
    return { message: "E-mail confirmado com sucesso!" };
  }

  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  @ApiOperation({ summary: "Logout" })
  @Post("logout")
  async logout(@Request() req: Req, @Body() dto: RefreshTokenDTO) {
    const userId = (req.user as any).sub;
    await this.auth.logout(userId, dto.refreshToken);
    return { message: "Desconectado com sucesso." };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @ApiOperation({ summary: "Login" })
  @Post("login")
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post("refresh")
  @ApiOperation({ summary: "Refresh a token" })
  async refresh(@Body() dto: RefreshTokenDTO) {
    return this.auth.refresh(dto);
  }

  @Public()
  @Post("request-password-reset")
  @ApiOperation({ summary: "Request password reset" })
  async requestPasswordReset(@Body("email") email: string) {
    await this.auth.requestPasswordReset(email);
    return {
      message: "If a email is found, a recover password email will be send",
    };
  }

  @Public()
  @Post("reset-password")
  @ApiOperation({ summary: "Reset password" })
  async resetPassword(@Body() dto: ResetPasswordDTO) {
    await this.auth.resetPassword(dto);
    return true;
  }
}
