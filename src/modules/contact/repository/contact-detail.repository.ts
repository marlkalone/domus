import { Injectable } from "@nestjs/common";
import { ContactDetail } from "../../../infra/database/entities/contactDetail.entity";
import { DataSource, EntityManager, Repository } from "typeorm";

@Injectable()
export class ContactDetailRepository {
  private readonly repo: Repository<ContactDetail>;

  constructor(private readonly ds: DataSource) {
    this.repo = this.ds.getRepository(ContactDetail);
  }

  private getRepo(manager?: EntityManager): Repository<ContactDetail> {
    return manager ? manager.getRepository(ContactDetail) : this.repo;
  }

  async deleteByContact(
    contactId: number,
    manager?: EntityManager,
  ): Promise<void> {
    await this.getRepo(manager).delete({ contact: { id: contactId } });
  }

  save(
    entities: ContactDetail[],
    manager?: EntityManager,
  ): Promise<ContactDetail[]> {
    return this.getRepo(manager).save(entities);
  }
}
