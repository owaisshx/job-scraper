import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type JobDocument = Job & Document;

@Schema({ timestamps: true })
export class Job {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  company: string;

  @Prop()
  location: string;

  @Prop()
  salary: string;

  @Prop({ required: true, unique: true })
  url: string;

  @Prop()
  description: string;

  @Prop()
  source: string; // e.g. "rozee.pk", "indeed"

  @Prop()
  searchQuery: string;

  @Prop({ default: false })
  isProcessed: boolean;

  @Prop({ default: Date.now })
  scrapedAt: Date;
}

export const JobSchema = SchemaFactory.createForClass(Job);

// Prevent duplicate jobs by URL
JobSchema.index({ url: 1 }, { unique: true });
