import { Expose, Type } from "class-transformer";
import { UserType } from "../../../common/enums/user.enum";
import { AddressResponseDTO } from "../../../common/utils/address-response.dto";
import { AttachmentResponseDTO } from "../../../common/utils/attachment-key-response.dto";
import { SubscriptionResponseDTO } from "../../subscription/dto/subscription-response.dto";
import { ValidateNested } from "class-validator";

export class UserResponseDTO {
  @Expose()
  readonly id: number;

  @Expose()
  readonly name: string;

  @Expose()
  readonly email: string;

  @Expose()
  readonly phone?: string;

  @Expose()
  readonly type: UserType;

  @Expose()
  readonly document: string;

  @Expose()
  readonly createdAt: Date;

  @Expose()
  readonly version: number;

  @Expose()
  @ValidateNested()
  @Type(() => AddressResponseDTO)
  readonly address: AddressResponseDTO;

  @Expose()
  @ValidateNested({ each: true })
  @Type(() => AttachmentResponseDTO)
  readonly attachments: AttachmentResponseDTO[];

  @Expose()
  @ValidateNested({ each: true })
  @Type(() => SubscriptionResponseDTO)
  readonly subscriptions: SubscriptionResponseDTO[];
}
