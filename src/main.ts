import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Job Scraper running on port ${port}`);
  logger.log(`MongoDB: ${process.env.MONGODB_URI}`);
  logger.log(`Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
}

bootstrap();
