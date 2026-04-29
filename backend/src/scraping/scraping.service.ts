import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma, PriceCapture } from '../../generated/prisma/client.js';
import { Page } from 'playwright';
import { PrismaService } from '../database/prisma.service';
import { PlaywrightService } from './playwright.service';
import { PriceExtractor, PriceStrategy } from './price.extractor';
import { PromoExtractor } from './promo.extractor';

export interface ScrapingResult {
  success: boolean;
  retailerUrlId: number;
  checkResult: string;
  currentPrice: number | null;
  capture?: PriceCapture;
  error?: string;
}

type CaptureData = {
  currentPrice?: number | null;
  struckPrice?: number | null;
  promoText?: string | null;
  promoType?: string | null;
  discountPct?: number | null;
  detectedName?: string | null;
  screenshotPath?: string | null;
  htmlPath?: string | null;
  checkResult: string;
  rawData?: Record<string, unknown>;
};

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);
  private readonly evidenceBase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly playwright: PlaywrightService,
    private readonly priceExtractor: PriceExtractor,
    private readonly promoExtractor: PromoExtractor,
  ) {
    this.evidenceBase =
      process.env.EVIDENCE_BASE_PATH ?? path.join(process.cwd(), 'evidence');
  }

  async scrape(retailerUrlId: number): Promise<ScrapingResult> {
    const retailerUrl = await this.prisma.retailerUrl.findUnique({
      where: { id: retailerUrlId },
    });

    if (!retailerUrl) {
      this.logger.warn(`RetailerUrl #${retailerUrlId} not found`);
      return {
        success: false,
        retailerUrlId,
        checkResult: 'error',
        currentPrice: null,
        error: 'RetailerUrl not found',
      };
    }

    let page: Page | null = null;

    try {
      page = await this.playwright.createPage();
    } catch (err) {
      this.logger.error(`Browser init failed: ${err}`);
      await this.updateStatus(retailerUrlId, 'error');
      await this.persistCapture(retailerUrlId, {
        checkResult: 'error',
        rawData: { error: 'browser_init_failed', detail: String(err) },
      });
      return {
        success: false,
        retailerUrlId,
        checkResult: 'error',
        currentPrice: null,
        error: 'Browser init failed',
      };
    }

    try {
      // 1. Navigate
      const navOk = await this.navigate(page, retailerUrl.url);

      if (!navOk) {
        await this.persistCapture(retailerUrlId, {
          checkResult: 'error',
          rawData: { error: 'navigation_failed', url: retailerUrl.url },
        });
        await this.updateStatus(retailerUrlId, 'error');
        return {
          success: false,
          retailerUrlId,
          checkResult: 'error',
          currentPrice: null,
          error: 'Navigation failed',
        };
      }

      // 2. Extract price (using learned selector when available)
      const priceResult = await this.priceExtractor.extract(
        page,
        retailerUrl.learnedSelector,
      );

      // 3. Detect promo
      const promoResult = await this.promoExtractor.extract(
        page,
        priceResult.currentPrice,
      );

      // 4. Save evidence
      const datePath = new Date().toISOString().split('T')[0];
      const timestamp = Date.now();
      const [screenshotPath, htmlPath] = await Promise.all([
        this.saveScreenshot(page, retailerUrlId, datePath, timestamp),
        this.saveHtml(page, retailerUrlId, datePath, timestamp),
      ]);

      // 5. Determine checkResult
      const checkResult = this.determineCheckResult(
        priceResult.currentPrice,
        promoResult.hasPromo,
      );

      // 6. Persist PriceCapture
      const savedCapture = await this.persistCapture(retailerUrlId, {
        currentPrice: priceResult.currentPrice,
        struckPrice: promoResult.struckPrice,
        promoText: promoResult.promoText,
        promoType: promoResult.promoType,
        discountPct: promoResult.discountPct,
        detectedName: priceResult.detectedName,
        screenshotPath,
        htmlPath,
        checkResult,
        rawData: priceResult.rawData,
      });

      // 7. Update RetailerUrl status + learned selector
      const newStatus = checkResult === 'not_found' ? 'not_found' : 'active';
      await this.updateAfterScrape(
        retailerUrlId,
        newStatus,
        priceResult.strategy,
        priceResult.winningCssSelector,
        retailerUrl.learnedSelector,
        retailerUrl.selectorConfidence,
      );

      return {
        success: true,
        retailerUrlId,
        checkResult,
        currentPrice: priceResult.currentPrice,
        capture: savedCapture,
      };
    } catch (err) {
      this.logger.error(`Unexpected error scraping #${retailerUrlId}: ${err}`);
      await this.persistCapture(retailerUrlId, {
        checkResult: 'error',
        rawData: { error: 'unexpected', detail: String(err) },
      }).catch(() => {});
      await this.updateStatus(retailerUrlId, 'error').catch(() => {});
      return {
        success: false,
        retailerUrlId,
        checkResult: 'error',
        currentPrice: null,
        error: String(err),
      };
    } finally {
      if (page) await this.playwright.closePage(page);
    }
  }

  private async navigate(page: Page, url: string): Promise<boolean> {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      return true;
    } catch {
      // networkidle may timeout on heavy sites — check if page loaded partially
      const currentUrl = page.url();
      if (currentUrl && currentUrl !== 'about:blank') {
        this.logger.warn(
          `networkidle timeout for ${url}, proceeding with partial load`,
        );
        return true;
      }
      this.logger.error(`Navigation failed entirely for ${url}`);
      return false;
    }
  }

  private async saveScreenshot(
    page: Page,
    retailerUrlId: number,
    datePath: string,
    timestamp: number,
  ): Promise<string | null> {
    try {
      const dir = path.join(this.evidenceBase, 'screenshots', datePath);
      fs.mkdirSync(dir, { recursive: true });
      const filename = `${retailerUrlId}_${timestamp}.png`;
      await page.screenshot({ path: path.join(dir, filename), fullPage: true });
      return path.posix.join('evidence', 'screenshots', datePath, filename);
    } catch (err) {
      this.logger.warn(`Screenshot failed: ${err}`);
      return null;
    }
  }

  private async saveHtml(
    page: Page,
    retailerUrlId: number,
    datePath: string,
    timestamp: number,
  ): Promise<string | null> {
    try {
      const dir = path.join(this.evidenceBase, 'html', datePath);
      fs.mkdirSync(dir, { recursive: true });
      const filename = `${retailerUrlId}_${timestamp}.html`;
      const html = await page.content();
      fs.writeFileSync(path.join(dir, filename), html, 'utf-8');
      return path.posix.join('evidence', 'html', datePath, filename);
    } catch (err) {
      this.logger.warn(`HTML save failed: ${err}`);
      return null;
    }
  }

  private async persistCapture(
    retailerUrlId: number,
    data: CaptureData,
  ): Promise<PriceCapture> {
    return this.prisma.priceCapture.create({
      data: {
        retailerUrlId,
        capturedAt: new Date(),
        currentPrice: data.currentPrice ?? null,
        struckPrice: data.struckPrice ?? null,
        promoText: data.promoText ?? null,
        promoType: data.promoType ?? null,
        discountPct: data.discountPct ?? null,
        detectedName: data.detectedName ?? null,
        screenshotPath: data.screenshotPath ?? null,
        htmlPath: data.htmlPath ?? null,
        checkResult: data.checkResult,
        rawData: data.rawData
          ? (data.rawData as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  private async updateStatus(
    retailerUrlId: number,
    status: string,
  ): Promise<void> {
    await this.prisma.retailerUrl.update({
      where: { id: retailerUrlId },
      data: { status },
    });
  }

  private async updateAfterScrape(
    retailerUrlId: number,
    status: string,
    strategy: PriceStrategy,
    winningCssSelector: string | null,
    previousSelector: string | null,
    previousConfidence: number | null,
  ): Promise<void> {
    const data: Prisma.RetailerUrlUpdateInput = { status };
    const prev = previousConfidence ?? 0;

    if (strategy === 'learned') {
      data.selectorConfidence = Math.min(1, prev + 0.1);
      data.lastSelectorUpdate = new Date();
    } else if (strategy === 'css' && winningCssSelector) {
      data.learnedSelector = winningCssSelector;
      data.selectorConfidence = 1;
      data.lastSelectorUpdate = new Date();
    } else if (previousSelector) {
      // structured strategy won OR none — decay the learned selector
      const delta = strategy === 'none' ? -0.2 : -0.1;
      const next = prev + delta;
      if (next < 0.3) {
        data.learnedSelector = null;
        data.selectorConfidence = null;
      } else {
        data.selectorConfidence = next;
      }
      data.lastSelectorUpdate = new Date();
    }

    await this.prisma.retailerUrl.update({
      where: { id: retailerUrlId },
      data,
    });
  }

  private determineCheckResult(
    currentPrice: number | null,
    hasPromo: boolean,
  ): string {
    if (currentPrice === null) return 'not_found';
    if (hasPromo) return 'promo';
    return 'ok';
  }
}
