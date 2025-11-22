/** Status of a revenue/expense item */
export enum TransactionStatus {
  TO_INVOICE = "to_invoice",
  INVOICED = "invoiced",
}

/** Revenue vs. expense */
export enum TransactionType {
  EXPENSE = "expense",
  REVENUE = "revenue",
}

export enum PeriodicityType {
  RECURRING = "recurring",
  ONE_TIME = "one_time",
}

export enum ExpenseCategory {
  ACQUISITION_COSTS = "ACQUISITION_COSTS", // Custos de aquisição (impostos, taxas)
  LEGAL_FEES = "LEGAL_FEES", // Custos de cartório, advogados
  DEMOLITION = "DEMOLITION", // Demolição
  CONSTRUCTION = "CONSTRUCTION", // Material de construção
  LABOR = "LABOR", // Mão de obra
  PERMITS = "PERMITS", // Licenças e alvarás
  STAGING = "STAGING", // Decoração para fotos/venda
  MARKETING = "MARKETING", // Anúncios de venda
  UTILITIES = "UTILITIES", // Contas (água, luz) durante a obra
  OTHER = "OTHER", // Outros
}

export type RentabilityFilter =
  | "weekly"
  | "monthly"
  | "trimestral"
  | "semestral"
  | "annual";
