import { IsString, IsNotEmpty } from "class-validator";

export class AttachmentKeyDTO {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  originalName: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;
}
