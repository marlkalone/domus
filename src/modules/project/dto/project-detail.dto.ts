import { Project } from "../../../infra/database/entities/project.entity";

/**
 * Este DTO é usado para RETORNAR os dados detalhados de um projeto,
 * incluindo os campos calculados (ROI, custos, etc.).
 */
export class ProjectDetailDTO extends Project {
  totalCosts: number; // Custo total (Aquisição + Despesas)
  estimatedProfit: number; // Lucro estimado (Meta de Venda - Custo Total)
  actualProfit?: number; // Lucro real (Venda Real - Custo Total)
  roi?: number; // Retorno sobre Investimento (Lucro / Custo Total) %
  tasksToday: { total: number; items: any[] };
  inventoryCount: number;
  collaboratorsCount: number;
}
