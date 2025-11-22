import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { Project } from "./project.entity";

@Entity("project_addresses")
export class ProjectAddress {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  zipCode: string;

  @Column()
  street: string;

  @Column()
  number: string;

  @Column({ nullable: true })
  complement: string;

  @Column()
  neighborhood: string;

  @Column()
  city: string;

  @Column()
  state: string;

  @OneToOne(() => Project, (p) => p.address, { onDelete: "CASCADE" })
  project: Project;
}
