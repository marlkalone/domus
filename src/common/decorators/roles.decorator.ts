import { SetMetadata } from "@nestjs/common";
import { Role } from "../enums/user.enum";

export const ROLES_KEY = "roles";
export const Roles = (...plans: Role[]) => SetMetadata(ROLES_KEY, plans);
