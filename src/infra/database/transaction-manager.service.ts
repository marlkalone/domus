import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";

/**
 * Este serviço encapsula a lógica de transação do TypeORM.
 * Ele permite que outros serviços executem operações atomicamente
 * sem se acoplarem diretamente ao TypeORM DataSource.
 */
@Injectable()
export class TransactionManagerService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Executa um conjunto de operações dentro de uma transação de banco de dados.
   * O 'callback' recebe um 'EntityManager' que DEVE ser usado
   * para todas as operações de repositório dentro da transação.
   *
   * @param callback A função que contém a lógica de negócios transacional.
   */
  async run<T>(callback: (manager: EntityManager) => Promise<T>): Promise<T> {
    // Inicia a transação e passa o EntityManager para o callback
    return this.dataSource.transaction(callback);
  }
}
