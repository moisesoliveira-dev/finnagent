import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Publico } from './auth/publico.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Publico()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
