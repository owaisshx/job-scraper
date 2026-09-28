import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Job, JobDocument } from './job.schema';

export interface CreateJobDto {
  title: string;
  company: string;
  location?: string;
  salary?: string;
  url: string;
  description?: string;
  source: string;
  searchQuery: string;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(@InjectModel(Job.name) private jobModel: Model<JobDocument>) {}

  // Save a job — skip if URL already exists (duplicate check)
  async saveJob(dto: CreateJobDto): Promise<{ saved: boolean; job: JobDocument }> {
    try {
      const job = await this.jobModel.findOneAndUpdate(
        { url: dto.url },
        { $setOnInsert: dto },
        { upsert: true, new: true, rawResult: true },
      );

      const isNew = job.lastErrorObject?.upserted != null;

      if (isNew) {
        this.logger.log(`✅ New job saved: "${dto.title}" at ${dto.company}`);
      } else {
        this.logger.debug(`⏭️  Duplicate skipped: "${dto.title}"`);
      }

      return { saved: isNew, job: job.value };
    } catch (error) {
      this.logger.error(`Failed to save job: ${dto.title}`, error.message);
      throw error;
    }
  }

  async getAllJobs(limit = 50, skip = 0): Promise<JobDocument[]> {
    return this.jobModel
      .find()
      .sort({ scrapedAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async getJobsByQuery(searchQuery: string): Promise<JobDocument[]> {
    return this.jobModel.find({ searchQuery }).sort({ scrapedAt: -1 }).exec();
  }

  async getTotalCount(): Promise<number> {
    return this.jobModel.countDocuments().exec();
  }

  async getStats() {
    const total = await this.getTotalCount();
    const bySource = await this.jobModel.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ]);
    const byQuery = await this.jobModel.aggregate([
      { $group: { _id: '$searchQuery', count: { $sum: 1 } } },
    ]);

    return { total, bySource, byQuery };
  }
}
