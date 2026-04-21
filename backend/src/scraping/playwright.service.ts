import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, Page, BrowserContext } from 'playwright';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const NAV_TIMEOUT_MS = 30_000;

@Injectable()
export class PlaywrightService implements OnModuleDestroy {
  private readonly logger = new Logger(PlaywrightService.name);
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({ headless: true });
    }
    return this.browser;
  }

  async createPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const context: BrowserContext = await browser.newContext({
      userAgent: USER_AGENT,
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    page.setDefaultTimeout(NAV_TIMEOUT_MS);
    return page;
  }

  async closePage(page: Page): Promise<void> {
    try {
      const context = page.context();
      await page.close();
      await context.close();
    } catch (err) {
      this.logger.warn(`Error closing page/context: ${err}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}
