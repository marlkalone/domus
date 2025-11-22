import { Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, DeepPartial, EntityManager, Repository } from "typeorm";
import { User } from "../../../infra/database/entities/user.entity";
import { UserType } from "../../../common/enums/user.enum";
import { PaginationResponse } from "../../../common/utils/pagination-response";
import { UserFilterDTO } from "../dto/user-filter.dto";

@Injectable()
export class UserRepository {
  private readonly repo: Repository<User>;

  constructor(private readonly dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(User);
  }

  private getManager(manager?: EntityManager): EntityManager {
    return manager || this.dataSource.manager;
  }

  async findAll(
    userFilterDto: UserFilterDTO,
    manager?: EntityManager,
  ): Promise<PaginationResponse<User>> {
    const { limit, skip, name, email, role } = userFilterDto;

    const repo = this.getManager(manager).getRepository(User);

    const query = repo.createQueryBuilder("user");

    if (name) {
      query.andWhere("user.name ILIKE :name", { name: `%${name}%` });
    }

    if (email) {
      query.andWhere("user.email ILIKE :email", { email: `%${email}%` });
    }

    if (role) {
      query.andWhere("user.role = :role", { role });
    }

    // Remover a senha do select
    query.select([
      "user.id",
      "user.name",
      "user.email",
      "user.role",
      "user.createdAt",
      "user.updatedAt",
    ]);

    const [users, total] = await query
      .skip(skip)
      .take(limit)
      .orderBy("user.createdAt", "DESC")
      .getManyAndCount();

    // Calcular o 'page' com base no 'skip' e 'limit'
    const page = Math.floor(skip / limit) + 1;

    // Retornar objeto literal que corresponde à interface PaginationResponse
    return {
      data: users,
      total: total,
      page: page,
      limit: limit,
    };
  }

  async findById(
    id: number,
    relations: string[] = [],
    manager?: EntityManager,
  ): Promise<User> {
    const user = await this.getManager(manager)
      .getRepository(User)
      .findOne({ where: { id }, relations });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async findByEmail(
    email: string,
    relations: string[] = [],
    manager?: EntityManager,
  ): Promise<User | null> {
    return await this.getManager(manager)
      .getRepository(User)
      .findOne({ where: { email }, relations });
  }

  async verifyUserExists(
    email: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const count = await this.getManager(manager)
      .getRepository(User)
      .count({ where: { email } });
    return count >= 1;
  }

  createAndSave(
    userData: DeepPartial<User>,
    manager: EntityManager, // Escritas devem exigir um manager
  ): Promise<User> {
    const user = manager.getRepository(User).create(userData);
    return manager.getRepository(User).save(user);
  }

  save(
    entity: User,
    manager: EntityManager, // Escritas devem exigir um manager
  ): Promise<User> {
    return manager.getRepository(User).save(entity);
  }

  async delete(id: number, manager: EntityManager): Promise<void> {
    const result = await manager.getRepository(User).delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User #${id} not found`);
    }
  }

  async getUserStats(): Promise<{
    total: number;
    individual: number;
    company: number;
  }> {
    const [total, individual, company] = await Promise.all([
      this.repo.count(),
      this.repo.count({ where: { type: UserType.INDIVIDUAL } }),
      this.repo.count({ where: { type: UserType.COMPANY } }),
    ]);

    return { total, individual, company };
  }
}
