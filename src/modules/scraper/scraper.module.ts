import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { SessionModule } from '../session/session.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [SessionModule, JobsModule],
  providers: [ScraperService],
  exports: [ScraperService],
})
export class ScraperModule {}
