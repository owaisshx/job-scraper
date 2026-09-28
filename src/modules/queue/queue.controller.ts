import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { QueueService } from './queue.service';

@Controller('queue')
export class QueueController {
  private readonly logger = new Logger(QueueController.name);

  constructor(private readonly queueService: QueueService) {}

  // GET /queue/stats - see what's in the queue
  @Get('stats')
  async getStats() {
    const stats = await this.queueService.getQueueStats();
    return { success: true, data: stats };
  }

  // POST /queue/trigger - manually trigger a scrape
  // Body: { "query": "React developer" }
  @Post('trigger')
  async triggerScrape(@Body() body: { query: string }) {
    if (!body.query) {
      return { success: false, message: 'query is required in request body' };
    }
    const message = await this.queueService.triggerManualScrape(body.query);
    this.logger.log(`Manual trigger: ${body.query}`);
    return { success: true, message };
  }

  // POST /queue/trigger-all - trigger all configured queries
  @Post('trigger-all')
  async triggerAll() {
    await this.queueService.addAllQueriesToQueue();
    return { success: true, message: 'All queries added to queue' };
  }
}
