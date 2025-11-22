import { Role } from "../../../common/enums/user.enum";
import { SubscriptionStatus } from "../../../common/enums/subscription.enum";

export class PayloadDTO {
  sub: number;
  email: string;
  role: Role;
  plan: string;
  status: SubscriptionStatus;
  subscription_id: number;
}
