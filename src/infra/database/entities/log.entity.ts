import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import { LogAction } from "../../../common/enums/log-action.enum";

@Entity("logs")
export class Log {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column()
  userId: number;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: "enum", enum: LogAction })
  action: LogAction;

  @Index()
  @Column()
  entityName: string;

  @Index()
  @Column()
  entityId: string;

  @Column({ type: "jsonb", nullable: true })
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}
