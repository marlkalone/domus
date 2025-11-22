import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { Subscription } from "../../../infra/database/entities/subscription.entity";
import { UserAddress } from "../../../infra/database/entities/userAddress.entity";
import { User } from "../../../infra/database/entities/user.entity";
import { UserService } from "../user.service";
import { Plan } from "../../../infra/database/entities/plan.entity";
import { RegisterDTO } from "../../auth/dto/register.dto";
import { UserType } from "../../../common/enums/user.enum";
import { AppModule } from "../../../app.module";
import { SubscriptionStatus } from "../../../common/enums/subscription.enum";
import { setupIntegrationTest } from "../../../../test/helpers/integration-test.helper";

describe("UserService (Integration)", () => {
  const testHelper = setupIntegrationTest();

  let app: TestingModule;
  let userService: UserService;
  let planRepo: Repository<Plan>;
  let userRepo: Repository<User>;
  let addressRepo: Repository<UserAddress>;
  let subRepo: Repository<Subscription>;

  const registerDto: RegisterDTO = {
    name: "Integration User",
    email: "integration@test.com",
    password: "Password123!",
    phone: "123456789",
    document: "12345678900",
    type: UserType.INDIVIDUAL,
    address: {
      zipCode: "12345-000",
      street: "Test Street",
      number: "100",
      neighborhood: "Test",
      city: "Testville",
      state: "TS",
    },
  };

  beforeAll(async () => {
    const app = testHelper.getApp();
    const dataSource = testHelper.getDataSource();

    // Obtém os serviços e repositórios REAIS (sem mocks)
    userService = app.get<UserService>(UserService);

    // Repositórios para asserções
    planRepo = dataSource.getRepository(Plan);
    userRepo = dataSource.getRepository(User);
    addressRepo = dataSource.getRepository(UserAddress);
    subRepo = dataSource.getRepository(Subscription);

    // ** SEED OBRIGATÓRIO **
    // O UserService.create DEPENDE que o plano 'FREE' exista.
    await planRepo.save({
      code: "FREE",
      name: "Free Plan",
      price: 0,
      features: "",
      isActive: true,
    });
  });

  beforeEach(async () => {
    // ** SEED OBRIGATÓRIO **
    // O UserService.create DEPENDE que o plano 'FREE' exista.
    await planRepo.save({
      code: "FREE",
      name: "Free Plan",
      price: 0,
      features: "",
      isActive: true,
    });
  });

  it("should be defined", () => {
    expect(userService).toBeDefined();
  });

  it("should create a User, UserAddress, and Subscription inside a transaction", async () => {
    // 1. Ação
    const createdUser = await userService.create(registerDto);

    // 2. Asserções (Verificando o banco de dados)
    expect(createdUser.id).toBeDefined();
    expect(createdUser.email).toBe(registerDto.email);

    // Verifica se o Usuário foi salvo
    const dbUser = await userRepo.findOneBy({ id: createdUser.id });
    expect(dbUser).toBeDefined();

    // Verifica se o Endereço foi salvo e linkado
    const dbAddress = await addressRepo.findOneBy({
      user: { id: createdUser.id },
    });
    expect(dbAddress).toBeDefined();
    expect(dbAddress!.zipCode).toBe(registerDto.address.zipCode);

    // Verifica se a Subscrição (Pending) foi salva e linkada
    const dbSub = await subRepo.findOne({
      where: { user: { id: createdUser.id } },
      relations: ["plan"],
    });
    expect(dbSub).toBeDefined();
    expect(dbSub!.status).toBe(SubscriptionStatus.PENDING);
    expect(dbSub!.plan!.code).toBe("FREE");
  });

  it("should ROLLBACK the transaction if any part fails (e.g., address fails)", async () => {
    // 1. Setup (DTO Inválido)
    // Criamos um DTO onde o endereço viola uma restrição (ex: 'street' é null)
    // (A entidade UserAddress define 'street' como não-nulo)
    const invalidDto = {
      ...registerDto,
      email: "rollback@test.com", // Email diferente
      address: {
        ...registerDto.address,
        street: null, // <<-- ERRO INTENCIONAL
      },
    };

    try {
      // 2. Ação
      await userService.create(invalidDto as any);
    } catch (error) {
      // 3. Asserção (Verificando o banco de dados)

      // Espera-se que o 'manager.save(UserAddress, address)' falhe
      expect(error).toBeDefined();

      // A PROVA DO ROLLBACK:
      // Se o txManager funcionou, o Usuário NÃO PODE existir no banco.
      const dbUser = await userRepo.findOneBy({ email: invalidDto.email });
      expect(dbUser).toBeNull();
    }
  });
});
