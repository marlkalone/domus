import { INestApplication } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import request from "supertest";
import { RegisterDTO } from "../src/modules/auth/dto/register.dto";
import { UserType } from "../src/common/enums/user.enum";
import { User } from "../src/infra/database/entities/user.entity";

import { setupE2eTest } from "./helpers/e2e-test.helper";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

describe("Auth E2E Tests", () => {
  let app: INestApplication;
  let httpServer: any;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let jwtService: JwtService;
  let configService: ConfigService;

  const TEST_EMAIL = "karlmalonex@gmail.com";
  const PASSWORD = "Password123!";

  const registerDto: RegisterDTO = {
    name: "E2E User",
    email: TEST_EMAIL,
    password: PASSWORD,
    phone: "123456789",
    document: "12345678900",
    type: UserType.INDIVIDUAL,
    address: {
      zipCode: "12345-000",
      street: "E2E Street",
      number: "100",
      neighborhood: "Test",
      city: "Testville",
      state: "TS",
    },
  };

  beforeAll(async () => {
    const setup = await setupE2eTest();
    app = setup.app;
    httpServer = setup.httpServer;
    dataSource = setup.dataSource;
    userRepo = dataSource.getRepository(User);

    jwtService = app.get<JwtService>(JwtService);
    configService = app.get<ConfigService>(ConfigService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await userRepo.delete({ email: TEST_EMAIL });
  });

  it("should be defined", () => {
    expect(app).toBeDefined();
  });

  // ==========================================
  // 1. CAMINHO FELIZ (HAPPY PATH)
  // ==========================================
  describe("Full Auth cycle", () => {
    it("should execute the FULL auth lifecycle: Register -> Verify -> Login -> Refresh -> Logout", async () => {
      // =================================================================
      // 1. REGISTER
      // =================================================================
      console.log("1. Testing Register...");
      await request(httpServer)
        .post("/api/v2/auth/register")
        .send(registerDto)
        .expect(201);

      const dbUser = await userRepo.findOneBy({ email: registerDto.email });
      expect(dbUser).toBeDefined();
      expect(dbUser!.emailVerified).toBe(false); // Começa falso

      // =================================================================
      // 2. VERIFY EMAIL (Sem hackear o banco)
      // =================================================================
      console.log("2. Testing Email Verification...");

      // Tenta logar antes de verificar (Deve falhar)
      await request(httpServer)
        .post("/api/v2/auth/login")
        .send({ email: registerDto.email, password: PASSWORD })
        .expect(401); // "Email not verified"

      // Simula o token que foi enviado por e-mail
      // NOTA: O payload deve bater com o que o AuthService gera
      const verificationToken = jwtService.sign(
        { sub: dbUser!.id, email: dbUser!.email },
        { expiresIn: "24h", secret: configService.get("JWT_SECRET") }, // Usa a secret padrão se não tiver específica para verificação
      );

      // Chama a rota de verificação
      await request(httpServer)
        .post("/api/v2/auth/verify-email")
        .send({ token: verificationToken })
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toContain("Successful operation");
        });

      // Verifica no banco se mudou de verdade
      const verifiedUser = await userRepo.findOneBy({
        email: registerDto.email,
      });
      expect(verifiedUser!.emailVerified).toBe(true);

      // =================================================================
      // 3. LOGIN
      // =================================================================
      console.log("3. Testing Login...");

      const loginResponse = await request(httpServer)
        .post("/api/v2/auth/login")
        .send({ email: registerDto.email, password: PASSWORD })
        .expect(201);

      const { access_token, refresh_token } = loginResponse.body.data;
      expect(access_token).toBeDefined();
      expect(refresh_token).toBeDefined();

      // =================================================================
      // 4. REFRESH TOKEN
      // =================================================================
      console.log("4. Testing Refresh Token...");

      // Aguarda 1 segundo só para garantir timestamp diferente (opcional)
      await new Promise((r) => setTimeout(r, 1000));

      const refreshResponse = await request(httpServer)
        .post("/api/v2/auth/refresh")
        .send({ refreshToken: refresh_token })
        .expect(201);

      const newAccessToken = refreshResponse.body.data.access_token;
      const newRefreshToken = refreshResponse.body.data.refresh_token;

      expect(newAccessToken).toBeDefined();
      expect(newRefreshToken).toBeDefined();
      // O novo token deve ser diferente do antigo
      expect(newAccessToken).not.toEqual(access_token);

      // =================================================================
      // 5. LOGOUT
      // =================================================================
      console.log("5. Testing Logout...");

      // Logout exige autenticação (Bearer Token) e o refresh token no body
      await request(httpServer)
        .post("/api/v2/auth/logout")
        .set("Authorization", `Bearer ${newAccessToken}`)
        .send({ refreshToken: newRefreshToken })
        .expect(201);

      // =================================================================
      // 6. TENTAR USAR O REFRESH TOKEN ANTIGO (Deve falhar)
      // =================================================================
      console.log("6. Verifying Token Invalidation...");

      await request(httpServer)
        .post("/api/v2/auth/refresh")
        .send({ refreshToken: newRefreshToken })
        .expect(401); // Unauthorized
    });
  });

  // ==========================================
  // 2. CENÁRIOS DE FALHA (FAILURE CASES)
  // ==========================================
  describe("2. Failure Scenarios & Edge Cases", () => {
    describe("POST /auth/register", () => {
      it("should REJECT (400) if DTO is invalid (missing email/password)", async () => {
        const invalidDto = { ...registerDto };
        delete (invalidDto as any).email;

        await request(httpServer)
          .post("/api/v2/auth/register")
          .send(invalidDto)
          .expect(400)
          .expect((res) => {
            // O ValidationPipe geralmente retorna um array de erros na mensagem
            expect(res.body.message).toBeInstanceOf(Array);
          });
      });

      it("should REJECT (409) if email is already registered (Duplicate)", async () => {
        // 1. Cria o primeiro usuário com sucesso
        await request(httpServer)
          .post("/api/v2/auth/register")
          .send(registerDto)
          .expect(201);

        // 2. Tenta criar o segundo com o MESMO email (mas documento diferente para isolar o erro no email)
        await request(httpServer)
          .post("/api/v2/auth/register")
          .send({ ...registerDto, document: "99988877700" })
          .expect(409); // ConflictException
      });
    });

    describe("POST /auth/login", () => {
      it("should REJECT (401) login with WRONG password", async () => {
        // Setup: Cria e verifica manualmente (hack de banco para velocidade)
        await request(httpServer)
          .post("/api/v2/auth/register")
          .send(registerDto);
        await userRepo.update({ email: TEST_EMAIL }, { emailVerified: true });

        // Attempt Login
        await request(httpServer)
          .post("/api/v2/auth/login")
          .send({ email: TEST_EMAIL, password: "WrongPassword123!" })
          .expect(401);
      });

      it("should REJECT (401) login for NON-EXISTENT user", async () => {
        await request(httpServer)
          .post("/api/v2/auth/login")
          .send({ email: "ghost.user@404.com", password: "AnyPassword" })
          .expect(401);
      });

      it("should REJECT (401) login if email is NOT VERIFIED", async () => {
        // Setup: Apenas cria, NÃO verifica
        await request(httpServer)
          .post("/api/v2/auth/register")
          .send(registerDto);

        // Attempt Login
        await request(httpServer)
          .post("/api/v2/auth/login")
          .send({ email: TEST_EMAIL, password: PASSWORD })
          .expect(401)
          .expect((res) => {
            // Valida se a mensagem de erro é informativa
            const msg = JSON.stringify(res.body).toLowerCase();
            expect(msg).toContain("verified");
          });
      });
    });

    describe("Protected Routes / Token Handling", () => {
      it("should REJECT (401) refresh with MALFORMED token", async () => {
        await request(httpServer)
          .post("/api/v2/auth/refresh")
          .send({ refreshToken: "invalid-token-string-123" })
          .expect(401);
      });

      it("should REJECT (401) access to protected route WITHOUT token", async () => {
        // Exemplo: Rota de logout exige auth
        await request(httpServer)
          .post("/api/v2/auth/logout")
          .send({ refreshToken: "any" })
          .expect(401); // Unauthorized (Missing Bearer)
      });
    });
  });
});
