import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const port = process.env.PORT;
  if (!port) {
    throw new Error('PORT é obrigatória');
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: '8mb' });
  await app.listen(port, '0.0.0.0');
}
await bootstrap();
