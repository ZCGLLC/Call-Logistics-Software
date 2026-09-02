import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { logger } from "./logger.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });
  app.setGlobalPrefix("api/v1");
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));

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
  logger.info({ port, provider: process.env.TELEPHONY_PROVIDER ?? "fake" }, "ZCG CI API listening");
}

bootstrap().catch((err) => {
  logger.error({ err }, "fatal");
  process.exit(1);
});
