import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../auth.service";
import { Subscription } from "../../../infra/database/entities/subscription.entity";
import { SubscriptionStatus } from "../../../common/enums/subscription.enum";
import { User } from "../../../infra/database/entities/user.entity";
import { Role } from "../../../common/enums/user.enum";
import { RegisterDTO } from "../dto/register.dto";
import { LoginDto } from "../dto/login.dto";
import { ConfigService } from "@nestjs/config";
import { UserService } from "../../user/user.service";
import { SubscriptionService } from "../../subscription/subscription.service";
import { RefreshTokenRepository } from "../repository/refresh-token.repository";
import { QueueProducerService } from "../../../infra/queue/queue.producer.service";
import { UserDataDTO } from "../dto/user-data.dto";
import { PayloadDTO } from "../dto/payload.dto";

jest.mock("bcrypt");

describe("AuthService", () => {
  let service: AuthService;
  let mockConfigService: any;
  let mockUserService: any;
  let mockSubService: any;
  let mockRtRepo: any;
  let mockJwtService: any;
  let mockQueueProducerService: any;

  const mockSubscription: Subscription = {
    id: 1,
    status: SubscriptionStatus.ACTIVE,
    plan: { id: 1, code: "PRO" } as any,
  } as any;

  const mockUser: User = {
    id: 1,
    email: "test@example.com",
    passwordHash: "hashed_password",
    emailVerified: true,
    version: 0,
    role: Role.USER,
    subscriptions: [mockSubscription],
  } as any;

  const mockUserNotVerified: User = {
    ...mockUser,
    emailVerified: false,
  } as any;

  const mockRegisterDto: RegisterDTO = {
    name: "Test",
    email: "test@example.com",
    password: "Password123!",
  } as any;

  const mockLoginDto: LoginDto = {
    email: "test@example.com",
    password: "Password123!",
  };

  beforeEach(async () => {
    (bcrypt.compare as jest.Mock).mockClear();
    (bcrypt.hash as jest.Mock).mockClear();
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue("hashed_refresh_token");

    mockConfigService = {
      get: jest.fn((key: string) => {
        // Retorna a própria chave para os secrets
        if (key === "JWT_REFRESH_SECRET") return "JWT_REFRESH_SECRET";
        if (key === "JWT_RESET_SECRET") return "JWT_RESET_SECRET";
        return key;
      }),
    };
    mockUserService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      markEmailVerified: jest.fn(),
      findById: jest.fn(),
      updatePassword: jest.fn(),
    };
    mockSubService = {
      getUserPlan: jest.fn(),
      getUserStatus: jest.fn(),
    };
    mockRtRepo = {
      findValidByUser: jest.fn(),
      remove: jest.fn(),
      removeByToken: jest.fn(),
      removeAllByUser: jest.fn(),
      createToken: jest.fn(),
    };
    mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
      signAsync: jest.fn(),
    };
    mockQueueProducerService = {
      sendEmailJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UserService, useValue: mockUserService },
        { provide: SubscriptionService, useValue: mockSubService },
        { provide: RefreshTokenRepository, useValue: mockRtRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: QueueProducerService, useValue: mockQueueProducerService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("register", () => {
    it("should create user, sign token, and send verification email", async () => {
      mockUserService.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue("verification_token");

      await service.register(mockRegisterDto);

      expect(mockUserService.create).toHaveBeenCalledWith(mockRegisterDto);
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, email: mockUser.email },
        { expiresIn: "24h" },
      );
      expect(mockQueueProducerService.sendEmailJob).toHaveBeenCalledWith(
        "sendVerification",
        expect.objectContaining({ token: "verification_token" }),
      );
    });
  });

  describe("verifyEmail", () => {
    it("should verify email successfully", async () => {
      mockJwtService.verify.mockReturnValue({ sub: 1 });

      await service.verifyEmail("valid_token");

      expect(mockJwtService.verify).toHaveBeenCalledWith("valid_token");
      expect(mockUserService.markEmailVerified).toHaveBeenCalledWith(1);
    });

    it("should throw Unauthorized on invalid token", async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error("jwt error");
      });
      await expect(service.verifyEmail("invalid_token")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("login", () => {
    const setupGenerateTokensMocks = () => {
      mockSubService.getUserPlan.mockResolvedValue("PRO");
      mockSubService.getUserStatus.mockResolvedValue(SubscriptionStatus.ACTIVE);
      mockJwtService.sign.mockReturnValue("access_token");
      mockJwtService.signAsync.mockResolvedValue("refresh_token");
      mockRtRepo.createToken.mockResolvedValue(true);
    };

    it("should return tokens on valid login", async () => {
      mockUserService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      setupGenerateTokensMocks();

      const result = await service.login(mockLoginDto);

      expect(result.access_token).toBe("access_token");
      expect(result.refresh_token).toBe("refresh_token");
      expect(mockRtRepo.createToken).toHaveBeenCalled();
    });

    it("should throw Unauthorized if user not found", async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw Unauthorized if email not verified", async () => {
      mockUserService.findByEmail.mockResolvedValue(mockUserNotVerified);
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw Unauthorized on wrong password", async () => {
      mockUserService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false); // Senha errada
      await expect(service.login(mockLoginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("refresh", () => {
    const setupGenerateTokensMocks = () => {
      mockSubService.getUserPlan.mockResolvedValue("PRO");
      mockSubService.getUserStatus.mockResolvedValue(SubscriptionStatus.ACTIVE);
      mockJwtService.sign.mockReturnValue("new_access_token");
      mockJwtService.signAsync.mockResolvedValue("new_refresh_token");
      mockRtRepo.createToken.mockResolvedValue(true);
    };

    it("should return new tokens on valid refresh", async () => {
      mockJwtService.verify.mockReturnValue({ sub: 1 });
      const mockValidToken = { id: 1, tokenHash: "hashed_refresh_token" };
      mockRtRepo.findValidByUser.mockResolvedValue([mockValidToken]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockUserService.findById.mockResolvedValue(mockUser);
      setupGenerateTokensMocks();

      const result = await service.refresh({ refreshToken: "valid_refresh" });

      expect(mockJwtService.verify).toHaveBeenCalledWith("valid_refresh", {
        secret: "JWT_REFRESH_SECRET",
      });
      expect(result.access_token).toBe("new_access_token");
      expect(mockRtRepo.remove).toHaveBeenCalledWith(mockValidToken);
      expect(mockRtRepo.createToken).toHaveBeenCalled();
    });

    it("should throw Unauthorized if token hash does not match", async () => {
      mockJwtService.verify.mockReturnValue({ sub: 1 });
      mockRtRepo.findValidByUser.mockResolvedValue([
        { id: 1, tokenHash: "wrong_hash" },
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.refresh({ refreshToken: "mismatch" }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("logout", () => {
    it("should remove one token if rt is provided", async () => {
      await service.logout(1, "token_to_remove");
      expect(mockRtRepo.removeByToken).toHaveBeenCalledWith(
        1,
        "token_to_remove",
      );
    });

    it("should remove all tokens if rt is not provided", async () => {
      await service.logout(1);
      expect(mockRtRepo.removeAllByUser).toHaveBeenCalledWith(1);
    });
  });

  describe("requestPasswordReset", () => {
    it("should find user and send email", async () => {
      mockUserService.findByEmail.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue("reset_token");

      await service.requestPasswordReset("test@example.com");

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 1, reset: true },
        { secret: "JWT_RESET_SECRET", expiresIn: "1h" },
      );
      expect(mockQueueProducerService.sendEmailJob).toHaveBeenCalledWith(
        "sendPasswordReset",
        expect.any(Object),
      );
    });

    it("should do nothing if user not found (security)", async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      await service.requestPasswordReset("not@found.com");
      expect(mockJwtService.sign).not.toHaveBeenCalled();
      expect(mockQueueProducerService.sendEmailJob).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    it("should reset password with valid token", async () => {
      mockJwtService.verify.mockReturnValue({ sub: 1, reset: true });
      mockUserService.findById.mockResolvedValue(mockUser);
      mockUserService.updatePassword.mockResolvedValue({ success: "ok" });

      await service.resetPassword({
        token: "valid_reset_token",
        newPassword: "newPassword123!",
      });

      expect(mockJwtService.verify).toHaveBeenCalledWith("valid_reset_token", {
        secret: "JWT_RESET_SECRET",
      });
      expect(mockUserService.updatePassword).toHaveBeenCalledWith({
        user_id: 1,
        password: "newPassword123!",
        version: mockUser.version,
      });
    });

    it("should throw if token is not a reset token", async () => {
      mockJwtService.verify.mockReturnValue({ sub: 1, reset: false });
      await expect(
        service.resetPassword({ token: "not_reset", newPassword: "new" }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("validateUser", () => {
    it("should return UserDataDTO on valid user", async () => {
      mockUserService.findById.mockResolvedValue(mockUser);
      mockSubService.getUserPlan.mockResolvedValue("PRO");
      mockSubService.getUserStatus.mockResolvedValue(SubscriptionStatus.ACTIVE);

      const result = await service.validateUser({ sub: 1 } as PayloadDTO);

      expect(result).toBeInstanceOf(UserDataDTO);
      expect(result.id).toBe(1);
      expect(result.plan).toBe("PRO");
    });

    it("should throw Unauthorized if email not verified", async () => {
      mockUserService.findById.mockResolvedValue(mockUserNotVerified);
      await expect(
        service.validateUser({ sub: 1 } as PayloadDTO),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw Unauthorized if plan not found", async () => {
      mockUserService.findById.mockResolvedValue(mockUser);
      mockSubService.getUserPlan.mockResolvedValue(null);
      await expect(
        service.validateUser({ sub: 1 } as PayloadDTO),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
