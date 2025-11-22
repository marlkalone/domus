import { ExecutionContext } from "@nestjs/common";

/**
 * Define o contrato para um manipulador de verificação de permissão.
 * Cada handler implementa a lógica para uma permissão de plano específica.
 */
export interface IPermissionHandler {
  /**
   * Executa a verificação de permissão.
   * @param permMap O Map de permissões do plano do usuário.
   * @param user O objeto de usuário do payload do token.
   * @param context O contexto de execução (para acessar req, params, body, etc.).
   * @throws {ForbiddenException} Se a verificação falhar.
   * @returns {Promise<void>} Se a verificação for bem-sucedida.
   */
  check(
    permMap: Map<string, number | boolean | null>,
    user: any,
    context: ExecutionContext,
  ): Promise<void>;
}
