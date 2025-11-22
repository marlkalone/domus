import {
  Inject,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from "@nestjs/common";
import { Cache, CACHE_MANAGER } from "@nestjs/cache-manager";
import { DataSource } from "typeorm";
import { PlanPermission } from "../../infra/database/entities/plan-permission.entity";
import { PermissionCatalog } from "../../infra/database/entities/permission-catalog.entity";
import { Plan } from "../../infra/database/entities/plan.entity";

export type PermissionMap = Map<string, number | boolean | null>;

@Injectable()
export class PermissionCacheService implements OnModuleInit {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private ds: DataSource,
  ) {}

  /**
   * Chamado quando o módulo é inicializado.
   */
  async onModuleInit() {
    console.log("Carregando permissões dos planos para o cache...");
    await this.loadAllPermissionsToCache();
  }

  /**
   * Força o recarregamento do cache.
   */
  async refreshCache() {
    await this.loadAllPermissionsToCache();
  }

  /**
   * Busca as permissões de um plano específico no cache.
   */
  async getPermissionsForPlan(planCode: string): Promise<PermissionMap> {
    const cacheKey = `permissions:${planCode}`;
    const cachedMap = await this.cacheManager.get<PermissionMap>(cacheKey);

    if (cachedMap) {
      return cachedMap;
    }

    // Failsafe: Se o cache estiver vazio, recarrega e tenta de novo.
    console.warn(`Cache miss for plan: ${planCode}. Recarregando...`);
    await this.loadAllPermissionsToCache();
    const newCachedMap = await this.cacheManager.get<PermissionMap>(cacheKey);

    if (!newCachedMap) {
      throw new InternalServerErrorException(
        `Falha ao carregar permissões para o plano ${planCode}`,
      );
    }

    return newCachedMap;
  }

  /**
   * Busca TODOS os planos e permissões do DB e salva no cache.
   */
  private async loadAllPermissionsToCache() {
    const plans = await this.ds.getRepository(Plan).find({
      relations: ["planPermissions", "planPermissions.permission"],
    });

    if (plans.length === 0) {
      console.error("Nenhum plano encontrado no banco de dados para cachear.");
      return;
    }

    for (const plan of plans) {
      const permMap = this.createPermissionMap(
        plan.planPermissions as PlanPermission[],
      );
      const cacheKey = `permissions:${plan.code}`;
      // Salva no cache sem TTL (infinito)
      await this.cacheManager.set(cacheKey, permMap, 0);
    }
    console.log(`Permissões para ${plans.length} planos carregadas no cache.`);
  }

  private createPermissionMap(
    planPermissions: PlanPermission[],
  ): PermissionMap {
    const permMap = new Map<string, number | boolean | null>();
    for (const pp of planPermissions) {
      if (!pp.permission) continue;

      const { code, kind } = pp.permission as PermissionCatalog;
      let val: number | boolean | null;

      if (pp.value === null) {
        val = null; // ilimitado
      } else if (kind === "boolean") {
        val = pp.value === "1";
      } else {
        val = Number(pp.value);
      }
      permMap.set(code, val);
    }
    return permMap;
  }
}
