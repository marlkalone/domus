import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Project } from "./project.entity";
import { BillingStatus } from "../../../common/enums/billing.enum";
import { Contact } from "./contact.entity";

@Entity("billings")
export class Billing {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  description: string;

  @Column("decimal", { precision: 9, scale: 2 })
  amount: number;

  @Column({ type: "date" })
  billingDate: Date;

  @Column({ type: "date" })
  dueDate: Date;

  @Column({ type: "date", nullable: true })
  paymentDate?: Date;

  @Column({
    type: "enum",
    enum: BillingStatus,
    default: BillingStatus.PENDING,
  })
  status: BillingStatus;

  @Column()
  version: number;

  @ManyToOne(() => Project, (p) => p.billings, { onDelete: "CASCADE" })
  project: Project;

  @ManyToOne(() => Contact, (c) => c.billings, { onDelete: "SET NULL" })
  @JoinColumn({ name: "contact_id" })
  contact: Contact;
}
