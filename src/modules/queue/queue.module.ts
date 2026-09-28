import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { QueueProcessor, SCRAPE_QUEUE } from './queue.processor';
import { QueueController } from './queue.controller';
import { ScraperModule } from '../scraper/scraper.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: SCRAPE_QUEUE }),
    ScraperModule,
  ],
  providers: [QueueService, QueueProcessor],
  controllers: [QueueController],
  exports: [QueueService],
})
export class QueueModule {}
