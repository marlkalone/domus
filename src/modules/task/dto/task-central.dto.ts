import { Task } from "../../../infra/database/entities/task.entity";

export interface OverdueByCollaborator {
  contactId: number;
  name: string;
  overdueCount: number;
}

export interface TaskCentralStats {
  total: number;
  completed: number;
  open: number;
  overdue: number;
  pctCompleted: number;
}

export interface CollaboratorStats {
  totalCollaborators: number;
  collaboratorsWithOverdue: number;
  overdueByCollaborator: OverdueByCollaborator[];
  collaboratorsNoTasksThisMonth: number;
}

export class TaskCentralDTO {
  tasks: Task[];
  tasksThisMonth: Task[];
  stats: TaskCentralStats;
  collaboratorStats: CollaboratorStats;
}
