import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
} from "typeorm";
import { Project } from "./project.entity";
import { Contact } from "./contact.entity";
import { Attachment } from "./attachment.entity";

@Entity("tasks")
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column({ type: "timestamp" })
  deadline: Date;

  @Column({ nullable: true })
  scheduleTime?: string;

  @Column()
  status: string;

  @Column()
  version: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => Project, (p) => p.tasks, { onDelete: "CASCADE" })
  project: Project;

  @ManyToOne(() => Contact, (c) => c.tasks, { onDelete: "CASCADE" })
  contact: Contact;

  @OneToMany(() => Attachment, (a) => a.task)
  attachments: Attachment[];
}
