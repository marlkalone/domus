import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Unique,
} from "typeorm";
import { Plan } from "./plan.entity";
import { PermissionCatalog } from "./permission-catalog.entity";

@Entity("plan_permissions")
@Unique("UQ_plan_permissions_plan_permission", ["plan", "permission"])
export class PlanPermission {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Plan, (plan) => plan.planPermissions, {
    onDelete: "CASCADE",
  })
  plan: Plan;

  @ManyToOne(() => PermissionCatalog, (perm) => perm.planPermissions, {
    eager: true,
    onDelete: "CASCADE",
  })
  permission: PermissionCatalog;

  @Column({ type: "varchar", nullable: true })
  value: string | null;
}
