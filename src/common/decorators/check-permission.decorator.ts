import { SetMetadata } from "@nestjs/common";

/**
 * Chave para armazenar metadados de permissão.
 */
export const PERMISSION_KEY = "permission_key";

/**
 * Decorator de método para anexar uma verificação de permissão a um endpoint.
 * O PlanGuard usará esta chave para determinar qual lógica de verificação executar.
 * * @example
 * @Post()
 * @CheckPermission('PROJECT_MAX_COUNT')
 * async createProject(...)
 */
export const CheckPermission = (code: string) =>
  SetMetadata(PERMISSION_KEY, code);
