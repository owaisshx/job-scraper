import { Injectable, Logger } from '@nestjs/common';
import { Browser, BrowserContext, chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly sessionDir = process.env.SESSION_FILE_PATH || './sessions';

  constructor() {
    // Make sure session folder exists
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
      this.logger.log(`📁 Session directory created: ${this.sessionDir}`);
    }
  }

  // Path where we store session cookies/storage for each site
  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionDir, `${sessionId}.json`);
  }

  // Check if a saved session exists on disk
  hasSession(sessionId: string): boolean {
    return fs.existsSync(this.getSessionPath(sessionId));
  }

  // Launch a browser with saved session (if available)
  async launchWithSession(sessionId: string): Promise<{
    browser: Browser;
    context: BrowserContext;
    isRestoredSession: boolean;
  }> {
    const browser = await chromium.launch({
      headless: true, // change to false to watch browser
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const sessionPath = this.getSessionPath(sessionId);
    const isRestoredSession = this.hasSession(sessionId);

    let context: BrowserContext;

    if (isRestoredSession) {
      this.logger.log(`🔄 Restoring saved session: ${sessionId}`);
      try {
        // Load saved cookies + localStorage from file
        context = await browser.newContext({
          storageState: sessionPath,
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        });
        this.logger.log(`✅ Session restored: ${sessionId}`);
      } catch (err) {
        // Session file corrupt — start fresh
        this.logger.warn(`⚠️ Session file corrupt, starting fresh: ${err.message}`);
        fs.unlinkSync(sessionPath);
        context = await browser.newContext();
      }
    } else {
      this.logger.log(`🆕 No saved session, starting fresh: ${sessionId}`);
      context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      });
    }

    return { browser, context, isRestoredSession };
  }

  // Save session state to disk after successful scrape
  async saveSession(context: BrowserContext, sessionId: string): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId);
    try {
      await context.storageState({ path: sessionPath });
      this.logger.log(`💾 Session saved: ${sessionId}`);
    } catch (err) {
      this.logger.error(`Failed to save session ${sessionId}: ${err.message}`);
    }
  }

  // Check if session is still valid (not expired)
  // We open the site and check if we are still logged in
  async isSessionAlive(context: BrowserContext, checkUrl: string, loggedInSelector: string): Promise<boolean> {
    const page = await context.newPage();
    try {
      await page.goto(checkUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

      // If the logged-in element exists, session is alive
      const isLoggedIn = await page.locator(loggedInSelector).isVisible().catch(() => false);
      this.logger.log(`🔍 Session alive check: ${isLoggedIn ? '✅ alive' : '❌ expired'}`);
      return isLoggedIn;
    } catch (err) {
      this.logger.warn(`Session alive check failed: ${err.message}`);
      return false;
    } finally {
      await page.close();
    }
  }

  // Delete a session (force re-login next time)
  deleteSession(sessionId: string): void {
    const sessionPath = this.getSessionPath(sessionId);
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
      this.logger.log(`🗑️ Session deleted: ${sessionId}`);
    }
  }

  // Clean up old sessions older than X days
  cleanOldSessions(olderThanDays = 7): void {
    const files = fs.readdirSync(this.sessionDir);
    const now = Date.now();
    let deleted = 0;

    files.forEach((file) => {
      const filePath = path.join(this.sessionDir, file);
      const stat = fs.statSync(filePath);
      const ageInDays = (now - stat.mtimeMs) / (1000 * 60 * 60 * 24);

      if (ageInDays > olderThanDays) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    });

    if (deleted > 0) {
      this.logger.log(`🧹 Cleaned ${deleted} old session(s)`);
    }
  }
}
