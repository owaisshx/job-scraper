import { Module } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

@Module({})
export class ConfigModule {
  static forRoot() {
    const envFile = '.env';
    if (fs.existsSync(envFile)) {
      dotenv.config({ path: envFile });
    }
    return { module: ConfigModule };
  }
}

// Load env immediately when this file is imported
dotenv.config();
