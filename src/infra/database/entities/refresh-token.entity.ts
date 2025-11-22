import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity("refresh_tokens")
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tokenHash: string;

  @ManyToOne(() => User, (user) => user.refreshTokens, {
    onDelete: "CASCADE",
  })
  user: User;

  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
