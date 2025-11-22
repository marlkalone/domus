import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { Role } from "../enums/user.enum";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.role) {
      throw new ForbiddenException("User role not found");
    }

    const hierarchy: Record<Role, number> = {
      [Role.USER]: 0,
      [Role.ADMIN]: 1,
      [Role.SUPER_ADMIN]: 2,
    };

    const userLevel = hierarchy[user.role as Role];
    const requiredLevels = requiredRoles.map((r) => hierarchy[r]);
    const minRequired = Math.min(...requiredLevels);

    if (userLevel < minRequired) {
      throw new ForbiddenException("Permissões insuficientes");
    }

    return true;
  }
}
