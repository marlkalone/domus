import { IsString, IsNotEmpty } from "class-validator";

/**
 * DTO auxiliar para o array 'details' em CreateProjectDTO e UpdateProjectDTO.
 * Baseado no antigo 'PropertyDetailDTO'.
 */
export class ProjectDetailItemDTO {
  @IsString()
  @IsNotEmpty()
  key: string; // Ex: "Quartos", "Banheiros", "Área (m²)"

  @IsString()
  @IsNotEmpty()
  value: string; // Ex: "3", "2", "120"
}
