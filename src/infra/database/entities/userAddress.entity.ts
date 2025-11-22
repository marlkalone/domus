import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity("user_addresses")
export class UserAddress {
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

  @Column()
  version: number;

  @OneToOne(() => User, (user) => user.address, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
}
