import { Expose } from "class-transformer";
import { AttachmentOwnerType } from "../enums/subscription.enum";

export class AttachmentResponseDTO {
  @Expose()
  readonly id: number;

  @Expose()
  readonly ownerType: AttachmentOwnerType;

  @Expose()
  readonly ownerId: number;

  @Expose()
  readonly url: string;

  @Expose()
  readonly originalName: string;

  @Expose()
  readonly mimeType: string;

  @Expose()
  readonly key: string;

  @Expose()
  readonly userId: number;

  @Expose()
  readonly contactId: number;

  @Expose()
  readonly projectId: number;

  @Expose()
  readonly inventoryItemId: number;

  @Expose()
  readonly taskId: number;

  @Expose()
  readonly transactionId: number;
}
