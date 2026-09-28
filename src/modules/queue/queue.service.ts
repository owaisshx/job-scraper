import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SCRAPE_QUEUE, ScrapeJobData } from './queue.processor';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);

  // Search queries loaded from .env
  private readonly queries = (process.env.SEARCH_QUERIES || 'Node.js developer')
    .split(',')
    .map((q) => q.trim());

  private readonly location = process.env.SEARCH_LOCATION || 'Pakistan';

  constructor(@InjectQueue(SCRAPE_QUEUE) private readonly scrapeQueue: Queue) {}

  // When app starts, add initial jobs to queue
  async onModuleInit() {
    this.logger.log('🔧 QueueService initialized — adding startup jobs...');
    await this.addAllQueriesToQueue();
  }

  // Run every 6 hours automatically
  @Cron('0 */6 * * *')
  async scheduledScrape() {
    this.logger.log('⏰ Scheduled scrape triggered (every 6 hours)');
    await this.addAllQueriesToQueue();
  }

  // Add all search queries to the BullMQ queue
  async addAllQueriesToQueue(): Promise<void> {
    this.logger.log(`📥 Adding ${this.queries.length} queries to queue...`);

    for (const query of this.queries) {
      await this.addScrapeJob({ query, location: this.location });
    }
  }

  // Add a single scrape job to queue
  async addScrapeJob(data: ScrapeJobData): Promise<void> {
    const jobId = `scrape_${data.query.replace(/\s+/g, '_')}_${Date.now()}`;

    await this.scrapeQueue.add('scrape', data, {
      jobId,
      attempts: 3,           // Retry up to 3 times if it fails
      backoff: {
        type: 'exponential', // Wait longer between each retry
        delay: 5000,         // Start with 5 seconds
      },
      removeOnComplete: 50,  // Keep last 50 completed jobs in Redis
      removeOnFail: 100,     // Keep last 100 failed jobs for debugging
    });

    this.logger.log(`📤 Job queued: "${data.query}" [${jobId}]`);
  }

  // Get queue stats (for API endpoint)
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.scrapeQueue.getWaitingCount(),
      this.scrapeQueue.getActiveCount(),
      this.scrapeQueue.getCompletedCount(),
      this.scrapeQueue.getFailedCount(),
      this.scrapeQueue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  // Manually trigger a scrape for a specific query (via API)
  async triggerManualScrape(query: string): Promise<string> {
    await this.addScrapeJob({ query, location: this.location });
    return `Job added to queue for: "${query}"`;
  }
}
