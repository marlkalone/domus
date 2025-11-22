import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Contact } from "./contact.entity";

@Entity("contact_details")
export class ContactDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  key: string;

  @Column()
  value: string;

  @ManyToOne(() => Contact, (c) => c.details, { onDelete: "CASCADE" })
  @JoinColumn({ name: "contact_id" })
  contact: Contact;
}
