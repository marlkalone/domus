import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { PlanPermission } from "./plan-permission.entity";

@Entity("permissions_catalog")
export class PermissionCatalog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  description: string;

  @Column()
  kind: "number" | "boolean" | "string";

  @OneToMany(() => PlanPermission, (pp) => pp.permission)
  planPermissions: PlanPermission[];
}
