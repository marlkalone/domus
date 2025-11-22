import { Expose } from "class-transformer";
export class AddressResponseDTO {
  @Expose()
  readonly id: number;

  @Expose()
  zipCode: string;

  @Expose()
  street: string;

  @Expose()
  number: string;

  @Expose()
  neighborhood: string;

  @Expose()
  city: string;

  @Expose()
  state: string;

  @Expose()
  complement?: string;

  @Expose()
  readonly version: number;
}
