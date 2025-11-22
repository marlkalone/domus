import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { ContactDetail } from "./contactDetail.entity";
import { Task } from "./task.entity";
import { Transaction } from "./transaction.entity";
import { Attachment } from "./attachment.entity";
import { ContactRole, ContactType } from "../../../common/enums/contact.enums";
import { Billing } from "./billing.entity";

@Entity("contacts")
export class Contact {
  @PrimaryGeneratedColumn() id: number;

  @Column({ type: "enum", enum: ContactRole })
  role: ContactRole;

  @Column({ type: "enum", enum: ContactType, nullable: true })
  contactType?: ContactType;

  @Column()
  name: string;

  @Column({ nullable: true })
  email?: string;

  @Column()
  phone: string;

  @Column()
  version: number;

  @ManyToOne(() => User, (u) => u.contacts, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @OneToMany(() => ContactDetail, (d) => d.contact)
  details: ContactDetail[];

  @OneToMany(() => Task, (t) => t.contact)
  tasks: Task[];

  @OneToMany(() => Transaction, (tx) => tx.contact)
  transactions: Transaction[];

  @OneToMany(() => Attachment, (a) => a.contact)
  attachments: Attachment[];

  @OneToMany(() => Billing, (b) => b.contact)
  billings: Billing[];
}
