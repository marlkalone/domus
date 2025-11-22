import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
} from "typeorm";
import { Project } from "./project.entity";
import { Attachment } from "./attachment.entity";
import {
  AmenityCategory,
  AmenityCondition,
} from "../../../common/enums/amenity.enum";

@Entity("amenities")
export class Amenity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ type: "enum", enum: AmenityCondition })
  condition: AmenityCondition;

  @Column({ type: "enum", enum: AmenityCategory })
  category: AmenityCategory;

  @Column()
  quantity: number;

  @Column({ default: false })
  includedInSale: boolean;

  @Column()
  version: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => Project, (p) => p.amenities, { onDelete: "CASCADE" })
  project: Project;

  @OneToMany(() => Attachment, (a) => a.amenity)
  attachments: Attachment[];
}
