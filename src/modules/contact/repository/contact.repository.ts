import { Injectable } from "@nestjs/common";
import { Contact } from "../../../infra/database/entities/contact.entity";
import { DataSource, EntityManager, Repository } from "typeorm";
import { ContactRole } from "../../../common/enums/contact.enums";
import { ContactFilterDTO } from "../dto/contact-filter.dto";

@Injectable()
export class ContactRepository {
  private readonly repo: Repository<Contact>;

  constructor(private readonly ds: DataSource) {
    this.repo = this.ds.getRepository(Contact);
  }

  private getRepo(manager?: EntityManager): Repository<Contact> {
    return manager ? manager.getRepository(Contact) : this.repo;
  }

  save(entity: Contact, manager?: EntityManager): Promise<Contact> {
    return this.getRepo(manager).save(entity);
  }

  async findOneByIdAndUser(
    id: number,
    userId: number,
    manager?: EntityManager,
  ): Promise<Contact | null> {
    return await this.getRepo(manager).findOne({
      where: { id, user: { id: userId } },
      relations: ["details", "attachments"],
    });
  }

  async findFilteredPaginated(
    userId: number,
    filter: ContactFilterDTO,
  ): Promise<{ items: Contact[]; total: number }> {
    const { skip = 0, limit = 10 } = filter;

    const qb = this.repo
      .createQueryBuilder("c")
      .innerJoin("c.user", "u", "u.id = :userId", { userId })
      .leftJoinAndSelect("c.details", "d")
      .leftJoinAndSelect("c.attachments", "a");

    if (filter.contactType) {
      qb.andWhere("c.contactType = :ct", { ct: filter.contactType });
    }
    if (filter.role) {
      qb.andWhere("c.role = :rl", { rl: filter.role });
    }
    if (filter.name) {
      qb.andWhere("c.name ILIKE :nm", { nm: `%${filter.name}%` });
    }
    if (filter.state) {
      qb.andWhere(
        "EXISTS(SELECT 1 FROM contact_details cd WHERE cd.contact_id = c.id AND cd.key = 'state' AND cd.value ILIKE :st)",
        { st: filter.state },
      );
    }

    const [items, total] = await qb
      .orderBy("c.name", "ASC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { items, total };
  }

  remove(entity: Contact, manager?: EntityManager): Promise<Contact> {
    return this.getRepo(manager).remove(entity);
  }

  findByUserAndRole(
    userId: number,
    role: ContactRole,
    manager?: EntityManager,
  ): Promise<Contact[]> {
    return this.getRepo(manager).find({
      where: { user: { id: userId }, role },
    });
  }
}
