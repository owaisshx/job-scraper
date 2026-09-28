import { Controller, Get, Query, Logger } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(private readonly jobsService: JobsService) {}

  // GET /jobs - get all jobs
  @Get()
  async getAllJobs(
    @Query('limit') limit = '50',
    @Query('skip') skip = '0',
  ) {
    const jobs = await this.jobsService.getAllJobs(+limit, +skip);
    return { success: true, count: jobs.length, data: jobs };
  }

  // GET /jobs/stats - get scraping stats
  @Get('stats')
  async getStats() {
    const stats = await this.jobsService.getStats();
    return { success: true, data: stats };
  }

  // GET /jobs/by-query?q=Node.js
  @Get('by-query')
  async getByQuery(@Query('q') query: string) {
    if (!query) return { success: false, message: 'Query param required' };
    const jobs = await this.jobsService.getJobsByQuery(query);
    return { success: true, count: jobs.length, data: jobs };
  }
}
