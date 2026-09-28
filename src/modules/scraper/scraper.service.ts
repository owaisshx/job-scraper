import { Injectable, Logger } from '@nestjs/common';
import { Page, BrowserContext } from 'playwright';
import { SessionService } from '../session/session.service';
import { JobsService, CreateJobDto } from '../jobs/jobs.service';

export interface ScrapeResult {
  query: string;
  totalFound: number;
  newlySaved: number;
  duplicates: number;
  errors: number;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly jobsService: JobsService,
  ) {}

  // Main entry point — scrape jobs for a given query
  async scrapeJobs(query: string, location = 'Pakistan'): Promise<ScrapeResult> {
    const sessionId = `rozee_${query.replace(/\s+/g, '_').toLowerCase()}`;
    const result: ScrapeResult = {
      query,
      totalFound: 0,
      newlySaved: 0,
      duplicates: 0,
      errors: 0,
    };

    const { browser, context } = await this.sessionService.launchWithSession(sessionId);

    try {
      this.logger.log(`🔍 Starting scrape for: "${query}" in ${location}`);

      const jobs = await this.scrapeRozee(context, query, location);
      result.totalFound = jobs.length;

      // Save each job to MongoDB
      for (const job of jobs) {
        try {
          const { saved } = await this.jobsService.saveJob({
            ...job,
            searchQuery: query,
            source: 'rozee.pk',
          });
          if (saved) result.newlySaved++;
          else result.duplicates++;
        } catch (err) {
          this.logger.error(`Error saving job: ${err.message}`);
          result.errors++;
        }
      }

      // Save session state for next time
      await this.sessionService.saveSession(context, sessionId);

      this.logger.log(
        `✅ Scrape complete for "${query}": ${result.totalFound} found, ${result.newlySaved} new, ${result.duplicates} duplicates`,
      );
    } catch (err) {
      this.logger.error(`❌ Scrape failed for "${query}": ${err.message}`);
      // If session might be stale, delete it so next run starts fresh
      if (err.message.includes('timeout') || err.message.includes('Navigation')) {
        this.sessionService.deleteSession(sessionId);
        this.logger.warn(`Session deleted for "${query}" — will start fresh next run`);
      }
      throw err;
    } finally {
      // Always close browser to free memory
      await context.close();
      await browser.close();
      this.logger.debug(`🔒 Browser closed for "${query}"`);
    }

    return result;
  }

  // Scrape Rozee.pk for job listings
  private async scrapeRozee(
    context: BrowserContext,
    query: string,
    location: string,
  ): Promise<Omit<CreateJobDto, 'searchQuery' | 'source'>[]> {
    const page = await context.newPage();
    const jobs: Omit<CreateJobDto, 'searchQuery' | 'source'>[] = [];

    try {
      // Block images and fonts to make scraping faster
      await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}', (route) =>
        route.abort(),
      );

      const searchUrl = `https://www.rozee.pk/job/jsearch/q/${encodeURIComponent(query)}`;
      this.logger.log(`📡 Navigating to: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Wait for job listings to appear
      await page.waitForSelector('.job-listing, .job-item, [class*="job"]', {
        timeout: 15000,
      }).catch(() => {
        this.logger.warn('Job listing selector not found — page structure may have changed');
      });

      // Take screenshot for debugging (saves to disk)
      await page.screenshot({ path: `./sessions/debug_${query.replace(/\s/g, '_')}.png` });

      // Extract job data from page
      const rawJobs = await page.evaluate(() => {
        const results: any[] = [];

        // Try multiple selectors since site layout can change
        const jobCards = document.querySelectorAll(
          '.job-listing, .job-item, .job-card, [data-job-id]',
        );

        jobCards.forEach((card) => {
          try {
            const titleEl =
              card.querySelector('.job-title a, .title a, h2 a, h3 a') ||
              card.querySelector('a[href*="/job/"]');
            const companyEl =
              card.querySelector('.company-name, .company, [class*="company"]');
            const locationEl =
              card.querySelector('.location, .job-location, [class*="location"]');
            const salaryEl =
              card.querySelector('.salary, .pay, [class*="salary"]');

            if (titleEl) {
              results.push({
                title: titleEl.textContent?.trim() || '',
                company: companyEl?.textContent?.trim() || 'Unknown',
                location: locationEl?.textContent?.trim() || '',
                salary: salaryEl?.textContent?.trim() || 'Not specified',
                url: (titleEl as HTMLAnchorElement).href || '',
              });
            }
          } catch (e) {
            // Skip cards that fail to parse
          }
        });

        return results;
      });

      // Filter out jobs with no URL (invalid entries)
      const validJobs = rawJobs.filter((j) => j.url && j.title);
      this.logger.log(`📋 Found ${validJobs.length} jobs on page`);

      jobs.push(...validJobs);

      // Try to go to page 2 as well
      const nextPageJobs = await this.scrapeNextPage(page, context);
      jobs.push(...nextPageJobs);
    } catch (err) {
      this.logger.error(`Error during Rozee scrape: ${err.message}`);
      throw err;
    } finally {
      await page.close();
    }

    return jobs;
  }

  // Scrape second page of results
  private async scrapeNextPage(
    currentPage: Page,
    context: BrowserContext,
  ): Promise<Omit<CreateJobDto, 'searchQuery' | 'source'>[]> {
    try {
      // Check if a "Next" button exists
      const nextBtn = await currentPage.locator('a[aria-label="Next"], .next-page, a:has-text("Next")').first();
      const isVisible = await nextBtn.isVisible().catch(() => false);

      if (!isVisible) {
        this.logger.debug('No next page found');
        return [];
      }

      const nextUrl = await nextBtn.getAttribute('href');
      if (!nextUrl) return [];

      this.logger.log(`📖 Scraping page 2: ${nextUrl}`);

      const page2 = await context.newPage();
      try {
        await page2.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}', (route) =>
          route.abort(),
        );

        await page2.goto(nextUrl.startsWith('http') ? nextUrl : `https://www.rozee.pk${nextUrl}`, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });

        await page2.waitForSelector('.job-listing, .job-item', { timeout: 10000 }).catch(() => {});

        const page2Jobs = await page2.evaluate(() => {
          const results: any[] = [];
          const jobCards = document.querySelectorAll('.job-listing, .job-item, .job-card');

          jobCards.forEach((card) => {
            const titleEl = card.querySelector('.job-title a, .title a, h2 a, h3 a');
            const companyEl = card.querySelector('.company-name, .company');
            const locationEl = card.querySelector('.location, .job-location');
            const salaryEl = card.querySelector('.salary, .pay');

            if (titleEl) {
              results.push({
                title: titleEl.textContent?.trim() || '',
                company: companyEl?.textContent?.trim() || 'Unknown',
                location: locationEl?.textContent?.trim() || '',
                salary: salaryEl?.textContent?.trim() || 'Not specified',
                url: (titleEl as HTMLAnchorElement).href || '',
              });
            }
          });

          return results;
        });

        this.logger.log(`📋 Page 2: Found ${page2Jobs.length} more jobs`);
        return page2Jobs.filter((j) => j.url && j.title);
      } finally {
        await page2.close();
      }
    } catch (err) {
      this.logger.warn(`Page 2 scraping failed (non-critical): ${err.message}`);
      return [];
    }
  }
}
