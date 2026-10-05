import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const port = process.env.PORT;
  if (!port) {
    throw new Error('PORT é obrigatória');
  }
  const app = await NestFactory.create(AppModule);
  await app.listen(port, '0.0.0.0');
}
await bootstrap();
