import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Project } from "./project.entity";

@Entity("project_details")
export class ProjectDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  key: string;

  @Column()
  value: string;

  @ManyToOne(() => Project, (p) => p.details, { onDelete: "CASCADE" })
  project: Project;
}
