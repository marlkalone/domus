import { Injectable, ConflictException } from "@nestjs/common";
import { Transaction } from "../../../infra/database/entities/transaction.entity";
import { DataSource } from "typeorm";

@Injectable()
export class RevenueConflictChecker {
  constructor(private readonly ds: DataSource) {}

  async ensureNoOverlap(
    propertyId: number,
    start: Date,
    end: Date,
    excludeId?: number,
  ): Promise<void> {
    const qb = this.ds
      .getRepository(Transaction)
      .createQueryBuilder("tx")
      .where("tx.property_id = :pid", { pid: propertyId })
      .andWhere("tx.type = :type", { type: "revenue" });
    if (excludeId) {
      qb.andWhere("tx.id != :eid", { eid: excludeId });
    }
    const existing = await qb.getMany();

    for (const tx of existing) {
      if (
        (start >= tx.startDate && start < (tx.endDate || tx.startDate)) ||
        (end > tx.startDate && end <= (tx.endDate || tx.startDate)) ||
        (start <= tx.startDate && end >= (tx.endDate || tx.startDate))
      ) {
        throw new ConflictException(
          `Overlaps existing revenue (id=${tx.id}) period.`,
        );
      }
    }
  }
}
