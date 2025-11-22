import {
  Injectable,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { UserRepository } from "./repository/user.repository";
import { UpdateUserDTO } from "./dto/update-user.dto";
import { UpdatePasswordDto } from "./dto/update-password.dto";
import { User } from "../../infra/database/entities/user.entity";
import { UserAddress } from "../../infra/database/entities/userAddress.entity";
import { Subscription } from "../../infra/database/entities/subscription.entity";
import { AttachmentService } from "../attachment/attachment.service";
import {
  AttachmentOwnerType,
  SubscriptionStatus,
} from "../../common/enums/subscription.enum";
import { SubscriptionService } from "../subscription/subscription.service";
import { Role } from "../../common/enums/user.enum";
import { TransactionManagerService } from "../../infra/database/transaction-manager.service";
import { EntityManager } from "typeorm";
import { PlanService } from "../subscription/plan.service";
import { UserFilterDTO } from "./dto/user-filter.dto";
import { PaginationResponse } from "../../common/utils/pagination-response";
import { RegisterDTO } from "../auth/dto/register.dto";
import { LogService } from "../log/log.service";

@Injectable()
export class UserService {
  constructor(
    private readonly repo: UserRepository,
    private readonly attachmentService: AttachmentService,
    @Inject(forwardRef(() => SubscriptionService))
    private readonly subscriptionService: SubscriptionService,
    private readonly planService: PlanService,
    private readonly txManager: TransactionManagerService,
    private readonly logService: LogService,
  ) {}

  async create(dto: RegisterDTO): Promise<User> {
    const user = await this.txManager.run(async (manager: EntityManager) => {
      if (await this.verifyUserExists(dto.email)) {
        throw new ConflictException("Email is already registered!");
      }

      const freePlan = await this.planService.findByCode("FREE");
      if (!freePlan) {
        throw new InternalServerErrorException(
          "FREE plan not found in database",
        );
      }

      const passwordHash = await bcrypt.hash(dto.password, 10);

      const newUser = await this.repo.createAndSave(
        {
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          document: dto.document,
          passwordHash,
          type: dto.type,
          role: Role.USER,
          version: 0,
        },
        manager,
      );

      // 5. Cria o endereço (usando o manager)
      const address = manager.create(UserAddress, {
        ...dto.address,
        version: 0,
        user: newUser,
      });
      await manager.save(UserAddress, address);

      // 6. Cria a subscrição (usando o manager)
      const sub = manager.create(Subscription, {
        user: newUser,
        plan: freePlan,
        status: SubscriptionStatus.PENDING,
      });
      await manager.save(Subscription, sub);

      // 7. Passa o manager para o AttachmentService
      if (dto.attachmentKeys?.length) {
        await this.attachmentService.createRecordsWithManager(
          manager,
          AttachmentOwnerType.USER,
          newUser.id,
          dto.attachmentKeys,
        );
      }

      await this.logService.logCreate(manager, newUser.id, "User", newUser);

      return newUser;
    });

    // 8. Chamadas externas (Stripe) ocorrem APÓS o commit da transação
    await this.subscriptionService.ensureCustomer(user.id);

    return user;
  }

  async update(userId: number, dto: UpdateUserDTO): Promise<User> {
    return this.txManager.run(async (manager: EntityManager) => {
      const user = await this.repo.findById(userId, ["address"], manager);

      if (dto.email && dto.email !== user.email) {
        if (await this.repo.verifyUserExists(dto.email, manager)) {
          throw new ConflictException("Email already in use");
        }
        user.email = dto.email;
      }

      await this.logService.logUpdate(manager, userId, "User", user, dto);

      // 4. Merge dos campos
      user.name = dto.name ?? user.name;
      user.phone = dto.phone ?? user.phone;
      user.document = dto.document ?? user.document;
      user.type = dto.type ?? user.type;
      user.version += 1;
      const updated = await this.repo.save(user, manager);

      // 5. Update do endereço (usando o manager)
      if (dto.address && user.address) {
        Object.assign(user.address, dto.address);
        user.address.version += 1;
        await manager.save(UserAddress, user.address);
      }

      // 6. Passa o manager para o AttachmentService
      if (dto.attachmentKeys) {
        await this.attachmentService.removeAllForOwnerWithManager(
          manager,
          AttachmentOwnerType.USER,
          user.id,
        );
        if (dto.attachmentKeys.length) {
          await this.attachmentService.createRecordsWithManager(
            manager,
            AttachmentOwnerType.USER,
            user.id,
            dto.attachmentKeys,
          );
        }
      }

      return updated;
    });
  }

  async updatePassword(dto: UpdatePasswordDto): Promise<{ success: string }> {
    await this.txManager.run(async (manager: EntityManager) => {
      const user = await this.repo.findById(dto.user_id, [], manager);

      if (dto.version !== user.version) {
        throw new BadRequestException("Version mismatch");
      }

      user.passwordHash = await bcrypt.hash(dto.password, 10);

      await this.logService.logUpdate(manager, user.id, "Project", user, dto);

      user.version += 1;

      await this.repo.save(user, manager);
    });
    return { success: "Password updated successfully" };
  }

  async markEmailVerified(userId: number): Promise<void> {
    await this.txManager.run(async (manager: EntityManager) => {
      const user = await this.repo.findById(userId, [], manager);
      user.emailVerified = true;
      await this.repo.save(user, manager);
    });
  }

  // ===================================================================
  // MÉTODOS UTILIZADOS TAMBÉM POR OUTROS MÓDULOS (ADMIN, AUTH)
  // ===================================================================

  async verifyUserExists(email: string): Promise<boolean> {
    return await this.repo.verifyUserExists(email);
  }

  async saveUser(user: User) {
    await this.txManager.run(async (manager: EntityManager) => {
      const existingUser = await this.repo.findById(user.id, [], manager);

      await this.logService.logUpdate(
        manager,
        user.id,
        "User",
        existingUser,
        user,
      );

      await this.repo.save(user, manager);
    });
  }

  async findAll(
    userFilterDto: UserFilterDTO,
  ): Promise<PaginationResponse<User>> {
    return this.repo.findAll(userFilterDto);
  }

  async findById(id: number): Promise<User> {
    return await this.repo.findById(id, [
      "address",
      "attachments",
      "subscriptions",
    ]);
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.repo.findByEmail(email, [
      "address",
      "attachments",
      "subscriptions",
    ]);
  }

  async deleteUser(id: number): Promise<void> {
    await this.txManager.run(async (manager: EntityManager) => {
      const user = await this.repo.findById(id, [], manager);

      await this.logService.logDelete(manager, id, "User", user);

      await this.repo.delete(user.id, manager);
    });
  }

  async getUserStats(): Promise<{
    total: number;
    individual: number;
    company: number;
  }> {
    return await this.repo.getUserStats();
  }
}
