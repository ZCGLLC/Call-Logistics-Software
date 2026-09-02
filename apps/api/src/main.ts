import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import express from "express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { telephonyConfigured, telephonyProviderId } from "@zcg/telephony";
import { logger } from "./logger.js";

async function bootstrap() {
  const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? "local";
  if (appEnv === "production") {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
      throw new Error("JWT_SECRET must be set to a long random string in production");
    }
    const tel = telephonyProviderId();
    if (tel === "fake" && process.env.ALLOW_FAKE_TELEPHONY !== "true") {
      throw new Error("TELEPHONY_PROVIDER=fake is blocked in production. Set twilio|telnyx or ALLOW_FAKE_TELEPHONY=true");
    }
    if (tel !== "fake" && !telephonyConfigured(tel)) {
      throw new Error(`${tel} is selected but credentials are missing`);
    }
  }
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });
  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.setGlobalPrefix("api/v1");
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: false }));
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });

  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("ZCG Call Intelligence API")
      .setDescription("Internal REST API for ZCG CI")
      .setVersion("1.0")
      .addCookieAuth(process.env.COOKIE_NAME ?? "zcg_session")
      .addApiKey({ type: "apiKey", name: "X-Api-Key", in: "header" })
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  logger.info(
    { port, provider: process.env.TELEPHONY_PROVIDER ?? "fake", appEnv: process.env.APP_ENV ?? "local" },
    "ZCG CI API listening",
  );
}

bootstrap().catch((err) => {
  logger.error({ err }, "fatal");
  process.exit(1);
});
