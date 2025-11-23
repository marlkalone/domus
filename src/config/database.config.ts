import * as path from "path";

const isTest = process.env.NODE_ENV === "test";
const isProduction = process.env.NODE_ENV === "production";

export default () => ({
    database: {
        type: "postgres",
        url: process.env.DATABASE_URL,
            ssl: isProduction ? { rejectUnauthorized: false } : false,
        database: isTest
            ? process.env.DATABASE_NAME_TEST || "domus-db-test"
            : process.env.DATABASE_NAME,
        synchronize: true,
        logging: ["warn", "error"],
        entities: [path.resolve(__dirname, "..", "**", "*.entity.{ts,js}")],
        migrations: [path.resolve(__dirname, "..", "migrations", "*.{ts,js}")],
        migrationsTableName: "migrations_typeorm",
        migrationsRun: false,
    },
});
