import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  InternalServerErrorException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SubscriptionStatus } from "../enums/subscription.enum";
import {
  ProjectMaxCountHandler,
  ProjectPhotoLimitHandler,
  ProjectVideoLimitHandler,
  AmenitiesPerProjectHandler,
  ContactMaxCountHandler,
  TaskActiveLimitHandler,
  TxMonthlyLimitHandler,
  TaxEnabledHandler,
  AttachTotalCountHandler,
} from "./permissions/permission.handlers";
import { PERMISSION_KEY } from "../decorators/check-permission.decorator";
import { PermissionCacheService } from "../../modules/permission-cache/permission-cache.service";

@Injectable()
export class PlanGuard implements CanActivate {
  private readonly handlers: Map<string, any>;

  constructor(
    private permissionCache: PermissionCacheService,
    private reflector: Reflector,
    projectMaxCountHandler: ProjectMaxCountHandler,
    projectPhotoLimitHandler: ProjectPhotoLimitHandler,
    projectVideoLimitHandler: ProjectVideoLimitHandler,
    inventoryItemsPerProjectHandler: AmenitiesPerProjectHandler,
    contactMaxCountHandler: ContactMaxCountHandler,
    taskActiveLimitHandler: TaskActiveLimitHandler,
    txMonthlyLimitHandler: TxMonthlyLimitHandler,
    taxEnabledHandler: TaxEnabledHandler,
    attachTotalCountHandler: AttachTotalCountHandler,
  ) {
    this.handlers = new Map();
    this.handlers.set("PROJECT_MAX_COUNT", projectMaxCountHandler);
    this.handlers.set("PROJECT_PHOTO_LIMIT", projectPhotoLimitHandler);
    this.handlers.set("PROJECT_VIDEO_LIMIT", projectVideoLimitHandler);
    this.handlers.set("AMENITIES_PER_PROJECT", inventoryItemsPerProjectHandler);
    this.handlers.set("CONTACT_MAX_COUNT", contactMaxCountHandler);
    this.handlers.set("TASK_ACTIVE_LIMIT", taskActiveLimitHandler);
    this.handlers.set("TX_MONTHLY_LIMIT", txMonthlyLimitHandler);
    this.handlers.set("TAX_ENABLED", taxEnabledHandler);
    this.handlers.set("ATTACH_TOTAL_COUNT", attachTotalCountHandler);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // 1. Obter o código da permissão do decorator @CheckPermission()
    const permissionCode = this.reflector.get<string>(
      PERMISSION_KEY,
      ctx.getHandler(),
    );

    // Se o endpoint não tiver o decorator, permita o acesso.
    if (!permissionCode) {
      return true;
    }

    // 2. Obter usuário e verificar status
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;

    if (!user || !user.plan) {
      throw new InternalServerErrorException(
        "Usuário ou plano não encontrado no token JWT",
      );
    }

    if (user.status !== SubscriptionStatus.ACTIVE) {
      throw new ForbiddenException("No active subscription found");
    }

    // 3. Obter permissões do plano (com cache)
    const permMap = await this.permissionCache.getPermissionsForPlan(user.plan);

    if (!permMap) {
      throw new InternalServerErrorException(
        `Falha ao obter mapa de permissão para o plano: ${user.plan}`,
      );
    }

    // 4. Encontrar o handler (Strategy) correto
    const handler = this.handlers.get(permissionCode);
    if (!handler) {
      throw new InternalServerErrorException(
        `No permission handler found for code: ${permissionCode}`,
      );
    }

    // 5. Executar a verificação
    // O handler irá disparar ForbiddenException se falhar
    await handler.check(permMap, user, ctx);

    // Se o handler não disparou erro, permita o acesso.
    return true;
  }
}
