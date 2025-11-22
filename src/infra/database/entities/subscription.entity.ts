import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { User } from "./user.entity";
import { Plan } from "./plan.entity";
import { SubscriptionStatus } from "../../../common/enums/subscription.enum";

@Entity("subscriptions")
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "enum", enum: SubscriptionStatus })
  status: SubscriptionStatus;

  @Column({ type: "timestamp", nullable: true })
  startDate?: Date;

  @Column({ type: "timestamp", nullable: true })
  endDate?: Date;

  @Column({ nullable: true })
  stripeSubscriptionId?: string;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date;

  @ManyToOne(() => User, (u) => u.subscriptions, { onDelete: "CASCADE" })
  user: User;

  @ManyToOne(() => Plan, (p) => p.subscriptions, { onDelete: "CASCADE" })
  plan: Plan;
}
