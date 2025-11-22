import * as path from "path";

const isTest = process.env.NODE_ENV === "test";

export default () => ({
  database: {
    type: "postgres",
    url: process.env.DATABASE_URL,
    database: isTest
      ? process.env.DATABASE_NAME_TEST || "domus-db-test"
      : process.env.DATABASE_NAME,
    synchronize: isTest,
    logging: ["warn", "error"],
    entities: [path.resolve(__dirname, "..", "**", "*.entity.{ts,js}")],
    migrations: [path.resolve(__dirname, "..", "migrations", "*.{ts,js}")],
    migrationsTableName: "migrations_typeorm",
    migrationsRun: true,
  },
});
