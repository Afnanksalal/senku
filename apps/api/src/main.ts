import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Controller()
class HealthController {
  @Get('health') health() { return { status: 'ok', service: 'api', stage: 'bootstrap' }; }
}
@Module({ controllers: [HealthController] })
class AppModule {}
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(Number(process.env.PORT || 3001), '0.0.0.0');
}
void bootstrap();
