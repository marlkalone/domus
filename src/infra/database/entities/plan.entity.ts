import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Subscription } from "./subscription.entity";
import { PlanPermission } from "./plan-permission.entity";

@Entity("plans")
export class Plan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column("decimal", { precision: 15, scale: 2 })
  price: number;

  @OneToMany(() => PlanPermission, (pp) => pp.plan, { cascade: true })
  planPermissions: PlanPermission[];

  @OneToMany(() => Subscription, (s) => s.plan)
  subscriptions: Subscription[];
}
