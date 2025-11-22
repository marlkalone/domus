import { Role } from "../../../common/enums/user.enum";
import { SubscriptionStatus } from "../../../common/enums/subscription.enum";

export class UserDataDTO {
  id: number;
  email: string;
  role: Role;
  plan: string;
  status: SubscriptionStatus;
}
