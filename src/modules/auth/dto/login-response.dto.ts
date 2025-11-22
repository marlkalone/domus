import { Expose, Type } from "class-transformer";
import { UserResponseDTO } from "./user-response.dto";
import { ValidateNested } from "class-validator";

export class LoginResponseDTO {
  @Expose()
  readonly access_token: string;

  @Expose()
  readonly refresh_token: string;

  @Expose()
  @ValidateNested()
  @Type(() => UserResponseDTO)
  readonly user: UserResponseDTO;

  @Expose()
  readonly plan: string;

  @Expose()
  readonly status: string;
}
