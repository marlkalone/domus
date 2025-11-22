import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { SubscriptionStatus } from "../../common/enums/subscription.enum";
import { Role } from "../../common/enums/user.enum";
import { User } from "../../infra/database/entities/user.entity";
import { EntityManager } from "typeorm";
import { UserAddress } from "../../infra/database/entities/userAddress.entity";
import { Subscription } from "../../infra/database/entities/subscription.entity";
import { CreateAdminDTO } from "./dto/create-admin.dto";
import { TransactionManagerService } from "../../infra/database/transaction-manager.service";
import { ProjectStatus } from "../../common/enums/project.enum";
import * as bcrypt from "bcrypt";
import { UserService } from "../user/user.service";
import { PlanService } from "../subscription/plan.service";
import { SubscriptionService } from "../subscription/subscription.service";
import { ProjectService } from "../project/project.service";
import { PaginationQueryDTO } from "../../common/utils/pagination-query.dto";

@Injectable()
export class AdminService {
  constructor(
    private readonly txManager: TransactionManagerService,
    private readonly userService: UserService,
    private readonly planService: PlanService,
    private readonly subscriptionService: SubscriptionService,
    private readonly projectService: ProjectService,
  ) {}

  async getSubscriptionsWithPlans(pagination: PaginationQueryDTO) {
    const { skip, limit } = pagination;

    const [subs, totalActive] =
      await this.subscriptionService.adminFindAllByStatus(
        SubscriptionStatus.ACTIVE,
        skip,
        limit,
      );

    if (!totalActive) {
      throw new NotFoundException("No active subscriptions found");
    }

    const { totalRevenue } =
      await this.subscriptionService.adminGetActiveSubscriptionStats();

    return {
      data: subs,
      total: totalActive,
      page: skip / limit + 1,
      limit: limit,
      totalRevenue, // Receita total de todas assinaturas ativas
    };
  }

  async getMonthlyRevenueByPlan() {
    const now = new Date();
    const start = startOfMonth(subMonths(now, 11));
    const end = endOfMonth(now);

    const plans = await this.planService.findAll();

    const buckets: Record<string, { month: string; revenue: number }[]> = {};
    const monthNames = Array.from({ length: 12 }, (_, i) =>
      format(subMonths(now, 11 - i), "MMMM"),
    );

    plans.forEach((p) => {
      buckets[p.name] = monthNames.map((monthName) => ({
        month: monthName,
        revenue: 0,
      }));
    });

    const dbResults =
      await this.subscriptionService.adminGetMonthlyRevenueByPlan(start, end);

    for (const res of dbResults) {
      const planBucket = buckets[res.planName];
      if (planBucket) {
        const monthBucket = planBucket.find(
          (b) => b.month.toLowerCase() === res.month.toLowerCase(),
        );
        if (monthBucket) {
          monthBucket.revenue = res.revenue;
        }
      }
    }

    return buckets;
  }

  /** Estatísticas dos Projetos */
  async getProjectStats() {
    const total = await this.projectService.adminCountAll();
    if (!total) {
      throw new NotFoundException("No projects found");
    }

    const counts = await this.projectService.adminCountByStatus();

    const stats = {
      total,
      [ProjectStatus.PRE_ACQUISITION]: 0,
      [ProjectStatus.PLANNING]: 0,
      [ProjectStatus.RENOVATION]: 0,
      [ProjectStatus.LISTED]: 0,
      [ProjectStatus.SOLD]: 0,
    };

    counts.forEach((c) => {
      if (stats.hasOwnProperty(c.status)) {
        stats[c.status] = c.total;
      }
    });

    return stats;
  }

  /** Estatísticas de usuários */
  async getUserStats(): Promise<{
    total: number;
    individual: number;
    company: number;
  }> {
    return await this.userService.getUserStats();
  }

  async create(dto: CreateAdminDTO): Promise<User> {
    if (await this.userService.verifyUserExists(dto.email)) {
      throw new ConflictException("Email already in use");
    }

    const address = {
      zipCode: "00000-000",
      street: "Admin Street",
      number: "1",
      complement: "",
      neighborhood: "Admin Town",
      city: "Admin City",
      state: "AC",
    };

    const plan = await this.planService.findByCode("PRO");

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return await this.txManager.run(async (manager: EntityManager) => {
      const u = manager.create(User, {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        document: dto.document || "00000000000",
        passwordHash,
        type: dto.type,
        role: Role.ADMIN,
        version: 0,
        emailVerified: true,
      });

      const newAdmin = await manager.save(User, u);

      const addr = manager.create(UserAddress, {
        ...address,
        version: 0,
        user: newAdmin,
      });

      await manager.save(UserAddress, addr);

      const sub = manager.create(Subscription, {
        user: newAdmin,
        plan: plan,
        status: SubscriptionStatus.ACTIVE,
      });

      await manager.save(Subscription, sub);

      return newAdmin;
    });
  }

  async deleteUser(userId: number): Promise<void> {
    return await this.userService.deleteUser(userId);
  }
}
