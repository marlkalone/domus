import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from "typeorm";
import { Project } from "./project.entity";
import { Contact } from "./contact.entity";
import { Tax } from "./tax.entity";
import { Attachment } from "./attachment.entity";
import {
  PeriodicityType,
  TransactionStatus,
  TransactionType,
} from "../../../common/enums/transaction.enum";

@Entity("transactions")
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  category: string;

  @Column({ type: "enum", enum: TransactionType })
  type: TransactionType;

  @Column({
    type: "enum",
    enum: PeriodicityType,
    default: PeriodicityType.ONE_TIME,
  })
  recurrence: PeriodicityType;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  paymentDate: Date;

  @Column({ type: "timestamp" })
  startDate: Date;

  @Column({ type: "timestamp", nullable: true })
  endDate?: Date;

  @Column("decimal", { precision: 15, scale: 2 })
  amount: number;

  @Column({ type: "enum", enum: TransactionStatus })
  status: TransactionStatus;

  @Column({ nullable: true })
  expenseType?: string;

  @Column()
  version: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // Coluna "Mãe": Uma transação pode ter UMA "Mãe".
  // Muitas transações ("Filhas") podem apontar para UMA "Mãe".
  @ManyToOne(() => Transaction, (transaction) => transaction.children, {
    nullable: true,
    onDelete: "CASCADE", // Se a "Mãe" for deletada, as "Filhas" também são.
  })
  @JoinColumn({ name: "parent_id" }) // Este é o nome real da coluna no Postgres
  parent: Transaction;

  // Coluna "Filhas": Uma transação ("Mãe") pode ter VÁRIAS "Filhas".
  @OneToMany(() => Transaction, (transaction) => transaction.parent)
  children: Transaction[];

  @ManyToOne(() => Project, (p) => p.transactions, { onDelete: "CASCADE" })
  project: Project;

  @ManyToOne(() => Contact, (c) => c.transactions, { onDelete: "CASCADE" })
  contact: Contact;

  @ManyToMany(() => Tax, (t) => t.transactions, { cascade: true })
  @JoinTable({
    name: "transaction_taxes",
    joinColumn: { name: "transaction_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "tax_id", referencedColumnName: "id" },
  })
  taxes: Tax[];

  @OneToMany(() => Attachment, (a) => a.transaction)
  attachments: Attachment[];
}
