import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ScraperService } from '../scraper/scraper.service';

export const SCRAPE_QUEUE = 'scrape-queue';

export interface ScrapeJobData {
  query: string;
  location: string;
  attempt?: number;
}

@Processor(SCRAPE_QUEUE)
export class QueueProcessor extends WorkerHost {
  private readonly logger = new Logger(QueueProcessor.name);

  constructor(private readonly scraperService: ScraperService) {
    super();
  }

  // This runs automatically when a job is picked from the queue
  async process(job: Job<ScrapeJobData>): Promise<any> {
    const { query, location } = job.data;

    this.logger.log(`🚀 Processing queue job #${job.id}: "${query}" in ${location}`);
    this.logger.log(`   Attempt: ${job.attemptsMade + 1} / ${job.opts.attempts}`);

    try {
      // Update job progress so we can track it
      await job.updateProgress(10);

      const result = await this.scraperService.scrapeJobs(query, location);

      await job.updateProgress(100);

      this.logger.log(
        `✅ Queue job #${job.id} done: ${result.newlySaved} new jobs saved for "${query}"`,
      );

      return result;
    } catch (err) {
      this.logger.error(`❌ Queue job #${job.id} failed: ${err.message}`);

      // BullMQ will automatically retry based on the attempts config
      // We just rethrow the error
      throw err;
    }
  }
}
