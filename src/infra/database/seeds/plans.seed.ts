import { DataSource, DeepPartial } from "typeorm";
import { Plan } from "../entities/plan.entity";

export async function seedPlans(ds: DataSource) {
  const planRepo = ds.getRepository(Plan);

  const plansData: DeepPartial<Plan>[] = [
    { code: "FREE", name: "Free", price: 0.0 },
    { code: "STARTER", name: "Starter", price: 29.9 },
    { code: "BASIC", name: "Basic", price: 59.9 },
    { code: "PRO", name: "Pro", price: 99.9 },
  ];

  for (const p of plansData) {
    const existing = await planRepo.findOne({ where: { code: p.code! } });
    if (existing) {
      existing.name = p.name!;
      existing.price = p.price!;
      await planRepo.save(existing);
    } else {
      await planRepo.save(planRepo.create(p));
    }
  }
}
