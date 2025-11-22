import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { User } from "./user.entity";
import { Contact } from "./contact.entity";
import { Project } from "./project.entity";
import { Task } from "./task.entity";
import { Transaction } from "./transaction.entity";
import { AttachmentOwnerType } from "../../../common/enums/subscription.enum";
import { Amenity } from "./amenity.entity";

@Entity("attachments")
export class Attachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "enum", enum: AttachmentOwnerType })
  ownerType: AttachmentOwnerType;

  @Column()
  ownerId: number;

  @Column()
  url: string;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @ManyToOne(() => User, (u) => u.attachments, { onDelete: "CASCADE" })
  user: User;

  @ManyToOne(() => Contact, (c) => c.attachments, { onDelete: "CASCADE" })
  contact: Contact;

  @ManyToOne(() => Project, (p) => p.attachments, { onDelete: "CASCADE" })
  project: Project;

  @ManyToOne(() => Amenity, (i) => i.attachments, { onDelete: "CASCADE" })
  amenity: Amenity;

  @ManyToOne(() => Task, (t) => t.attachments, { onDelete: "CASCADE" })
  task: Task;

  @ManyToOne(() => Transaction, (tx) => tx.attachments, { onDelete: "CASCADE" })
  transaction: Transaction;
}
