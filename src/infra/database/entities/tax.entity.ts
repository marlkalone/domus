import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
} from "typeorm";
import { User } from "./user.entity";
import { Transaction } from "./transaction.entity";

@Entity("taxes")
export class Tax {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  taxType: string;

  @Column("decimal", { precision: 9, scale: 2 })
  percentage: number;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  startDate: Date;

  @Column()
  version: number;

  @ManyToOne(() => User, (u) => u.taxes, { onDelete: "CASCADE" })
  user: User;

  @ManyToMany(() => Transaction, (tx) => tx.taxes)
  transactions: Transaction[];
}
