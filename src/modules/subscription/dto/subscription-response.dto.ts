import { Expose } from "class-transformer";

export class SubscriptionResponseDTO {
  @Expose()
  id: number;

  @Expose()
  status: string;

  @Expose()
  startDate: string;

  @Expose()
  endDate: string;

  @Expose()
  stripeSubscriptionId: string;

  @Expose()
  createdAt: string;

  @Expose()
  updatedAt: string;
}
