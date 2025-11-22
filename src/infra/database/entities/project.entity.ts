import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Task } from "./task.entity";
import { Transaction } from "./transaction.entity";
import { Billing } from "./billing.entity";
import { Attachment } from "./attachment.entity";
import { ProjectStatus } from "../../../common/enums/project.enum";
import { ProjectAddress } from "./projectAddress.entity";
import { ProjectDetail } from "./projectDetail.entity";
import { Amenity } from "./amenity.entity";

@Entity("projects")
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  acquisitionType: string;

  @Column({
    type: "enum",
    enum: ProjectStatus,
    default: ProjectStatus.PRE_ACQUISITION,
  })
  status: ProjectStatus;

  @Column("decimal", { precision: 15, scale: 2, default: 0 })
  acquisitionPrice: number;

  @Column("decimal", { precision: 15, scale: 2, default: 0 })
  targetSalePrice: number;

  @Column("decimal", { precision: 15, scale: 2, nullable: true })
  actualSalePrice?: number; // Valor real da venda (preenchido no final)

  @Column()
  version: number;

  @ManyToOne(() => User, (u) => u.projects, { onDelete: "CASCADE" })
  user: User;

  @OneToOne(() => ProjectAddress, (addr) => addr.project, { cascade: true })
  @JoinColumn({ name: "address_id" })
  address: ProjectAddress;

  @OneToMany(() => ProjectDetail, (d) => d.project)
  details: ProjectDetail[];

  @OneToMany(() => Amenity, (i) => i.project)
  amenities: Amenity[];

  @OneToMany(() => Task, (t) => t.project)
  tasks: Task[];

  @OneToMany(() => Transaction, (tx) => tx.project)
  transactions: Transaction[];

  @OneToMany(() => Billing, (b) => b.project)
  billings: Billing[];

  @OneToMany(() => Attachment, (a) => a.project)
  attachments: Attachment[];
}
