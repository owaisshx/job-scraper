import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ScraperModule } from './modules/scraper/scraper.module';
import { QueueModule } from './modules/queue/queue.module';
import { SessionModule } from './modules/session/session.module';

@Module({
  imports: [
    // Load env variables
    ConfigModule,

    // MongoDB connection
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/job-scraper'),

    // Redis / BullMQ connection
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),

    // Enable cron scheduling
    ScheduleModule.forRoot(),

    // Feature modules
    JobsModule,
    ScraperModule,
    QueueModule,
    SessionModule,
  ],
})
export class AppModule {}
