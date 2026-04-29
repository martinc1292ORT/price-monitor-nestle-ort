import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Alert,
  MonitoringRule,
  PriceCapture,
  Product,
  Prisma,
  RetailerUrl,
} from '../../generated/prisma/client.js';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import { PrismaService } from '../database/prisma.service';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import {
  RuleEvaluationCapture,
  RuleEvaluationProduct,
  RuleEvaluationRule,
  RuleSeverity,
  RuleType,
} from '../rules-engine/rules-engine.types';
import {
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  AlertSeverity,
  AlertStatus,
} from './alerts.constants';
import { QueryAlertsDto } from './dto/query-alerts.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';

type DecimalInput = Prisma.Decimal | number | string | null | undefined;

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesEngine: RulesEngineService,
  ) {}

  async createFromCapture(
    capture: PriceCapture,
    retailerUrl: RetailerUrl,
    product: Product,
  ): Promise<Alert[]> {
    const rules = await this.prisma.monitoringRule.findMany({
      where: { productId: product.id, isActive: true },
    });
    const evaluatedRules = rules
      .map((rule) => this.toRuleEvaluationRule(rule))
      .filter((rule): rule is RuleEvaluationRule => rule !== null);

    const results = this.rulesEngine.evaluate(
      this.toRuleEvaluationCapture(capture),
      this.toRuleEvaluationProduct(product),
      evaluatedRules,
    );

    if (results.length === 0) return [];

    const alertTypes = [...new Set(results.map((result) => result.alertType))];
    const existingOpenAlerts = await this.prisma.alert.findMany({
      where: {
        productId: product.id,
        retailerUrlId: retailerUrl.id,
        status: 'open',
        type: { in: alertTypes },
      },
      select: { type: true },
    });
    const blockedTypes = new Set(existingOpenAlerts.map((alert) => alert.type));
    const created: Alert[] = [];

    for (const result of results) {
      if (blockedTypes.has(result.alertType)) continue;

      const alert = await this.prisma.alert.create({
        data: {
          productId: product.id,
          retailerUrlId: retailerUrl.id,
          type: result.alertType,
          severity: result.severity,
          status: 'open',
          detectedValue: result.detectedValue,
          expectedValue: result.expectedValue,
          description: result.reason,
        },
      });
      blockedTypes.add(result.alertType);
      created.push(alert);
    }

    return created;
  }

  async findAll(filters: QueryAlertsDto): Promise<PaginatedResponse<unknown>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters);

    const [data, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.getInclude(),
      }),
      this.prisma.alert.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: number) {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
      include: this.getInclude(),
    });

    if (!alert) throw new NotFoundException(`Alert #${id} not found`);

    return alert;
  }

  async updateStatus(id: number, dto: UpdateAlertDto) {
    await this.ensureAlertExists(id);

    if (dto.assignedUserId !== undefined && dto.assignedUserId !== null) {
      await this.ensureUserExists(dto.assignedUserId);
    }

    const data: Prisma.AlertUncheckedUpdateInput = {};

    if (dto.status !== undefined) {
      data.status = dto.status;
      data.resolvedAt = dto.status === 'resolved' ? new Date() : null;
    }
    if (dto.comment !== undefined) data.comment = dto.comment;
    if (dto.resolutionComment !== undefined) {
      data.resolutionComment = dto.resolutionComment;
    }
    if (dto.assignedUserId !== undefined) {
      data.assignedUserId = dto.assignedUserId;
    }

    return this.prisma.alert.update({
      where: { id },
      data,
      include: this.getInclude(),
    });
  }

  async getSummary() {
    const [total, bySeverityRows, byStatusRows] = await Promise.all([
      this.prisma.alert.count(),
      this.prisma.alert.groupBy({
        by: ['severity'],
        _count: { _all: true },
      }),
      this.prisma.alert.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    return {
      total,
      bySeverity: this.mapCounts(ALERT_SEVERITIES, bySeverityRows, 'severity'),
      byStatus: this.mapCounts(ALERT_STATUSES, byStatusRows, 'status'),
    };
  }

  private buildWhere(filters: QueryAlertsDto): Prisma.AlertWhereInput {
    const where: Prisma.AlertWhereInput = {};

    if (filters.productId !== undefined) where.productId = filters.productId;
    if (filters.retailerUrlId !== undefined) {
      where.retailerUrlId = filters.retailerUrlId;
    }
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;

    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    return where;
  }

  private async ensureAlertExists(id: number): Promise<void> {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!alert) throw new NotFoundException(`Alert #${id} not found`);
  }

  private async ensureUserExists(id: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) throw new NotFoundException(`User #${id} not found`);
  }

  private toRuleEvaluationCapture(
    capture: PriceCapture,
  ): RuleEvaluationCapture {
    const struckPrice = this.toNumber(capture.struckPrice);
    const promoText = capture.promoText ?? null;
    const discountPct = this.toNumber(capture.discountPct);

    return {
      currentPrice: this.toNumber(capture.currentPrice),
      struckPrice,
      promoText,
      promoType: capture.promoType ?? null,
      discountPct,
      checkResult: capture.checkResult,
      hasPromo:
        capture.checkResult === 'promo' ||
        struckPrice !== null ||
        Boolean(promoText?.trim()) ||
        discountPct !== null,
    };
  }

  private toRuleEvaluationProduct(product: Product): RuleEvaluationProduct {
    return {
      targetPrice: this.toNumber(product.targetPrice) ?? 0,
      tolerance: this.toNumber(product.tolerance),
    };
  }

  private toRuleEvaluationRule(
    rule: MonitoringRule,
  ): RuleEvaluationRule | null {
    if (!this.isRuleType(rule.ruleType) || !this.isSeverity(rule.severity)) {
      return null;
    }

    return {
      id: rule.id,
      ruleType: rule.ruleType,
      minPrice: this.toNumber(rule.minPrice),
      maxPrice: this.toNumber(rule.maxPrice),
      allowPromos: rule.allowPromos,
      maxDiscountPct: this.toNumber(rule.maxDiscountPct),
      severity: rule.severity,
      isActive: rule.isActive,
    };
  }

  private toNumber(value: DecimalInput): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    const parsed = value.toNumber();
    return Number.isFinite(parsed) ? parsed : null;
  }

  private isRuleType(value: string): value is RuleType {
    return [
      'exact_price',
      'min_price',
      'max_price',
      'range',
      'no_promo',
    ].includes(value);
  }

  private isSeverity(value: string): value is RuleSeverity {
    return ALERT_SEVERITIES.includes(value as AlertSeverity);
  }

  private mapCounts<T extends string, K extends 'severity' | 'status'>(
    keys: readonly T[],
    rows: Array<{ [P in K]: string } & { _count: { _all: number } }>,
    field: K,
  ): Record<T, number> {
    const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<
      T,
      number
    >;

    for (const row of rows) {
      const key = row[field] as unknown as T;
      if (key in counts) counts[key] = row._count._all;
    }

    return counts;
  }

  private getInclude() {
    return {
      product: {
        select: { id: true, name: true, sku: true, targetPrice: true },
      },
      retailerUrl: { select: { id: true, retailerName: true, url: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
    };
  }
}
