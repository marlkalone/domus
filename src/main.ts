import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import * as express from "express";
import { apiReference } from "@scalar/nestjs-api-reference";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.setGlobalPrefix("api");

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "2",
    prefix: "v",
  });

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("API exemple")
    .setDescription("API description")
    .setVersion("2.0")
    .addTag("exemple")
    .build();

  const document = SwaggerModule.createDocument(app, config);

  app.use(
    "/docs",
    apiReference({
      spec: {
        content: document,
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type, Accept, Authorization, api-key",
    credentials: true,
  });

  app.enableShutdownHooks();

  await app.listen(process.env.PORT || 4000);
}
bootstrap();
