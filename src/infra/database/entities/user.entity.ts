import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
} from "typeorm";
import { UserAddress } from "./userAddress.entity";
import { Contact } from "./contact.entity";
import { Project } from "./project.entity";
import { Tax } from "./tax.entity";
import { Subscription } from "./subscription.entity";
import { Attachment } from "./attachment.entity";
import { RefreshToken } from "./refresh-token.entity";
import { Role, UserType } from "../../../common/enums/user.enum";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  phone: string;

  @Column()
  document: string;

  @Column({ type: "enum", enum: UserType })
  type: UserType;

  @Column({ type: "enum", enum: Role, default: Role.USER })
  role: Role;

  @Column({ nullable: true })
  stripeCustomerId?: string;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @Column()
  version: number;

  @OneToOne(() => UserAddress, (addr) => addr.user, { cascade: true })
  address: UserAddress;

  @OneToMany(() => Contact, (c) => c.user)
  contacts: Contact[];

  @OneToMany(() => Project, (p) => p.user)
  projects: Project[];

  @OneToMany(() => Tax, (t) => t.user)
  taxes: Tax[];

  @OneToMany(() => Subscription, (s) => s.user)
  subscriptions: Subscription[];

  @OneToMany(() => Attachment, (a) => a.user)
  attachments: Attachment[];

  @OneToMany(() => RefreshToken, (rt) => rt.user)
  refreshTokens: RefreshToken[];
}
