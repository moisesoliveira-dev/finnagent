import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { log } from './log.js';
import { registrarPedidos } from './registrar-pedidos.js';

async function bootstrap() {
  const port = process.env.PORT;
  if (!port) {
    throw new Error('PORT é obrigatória');
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: '64mb' });
  app.use(registrarPedidos);
  await app.listen(port, '0.0.0.0');
  log.info({ porta: port, nivel: log.level }, 'backend no ar');
}
await bootstrap();
