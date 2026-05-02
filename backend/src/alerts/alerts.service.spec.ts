jest.mock('../database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { NotFoundException } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import type {
  Alert,
  MonitoringRule,
  PriceCapture,
  Product,
  RetailerUrl,
} from '../../generated/prisma/client.js';

describe('AlertsService', () => {
  let service: AlertsService;
  let prisma: {
    monitoringRule: { findMany: jest.Mock };
    alert: {
      findMany: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      groupBy: jest.Mock;
    };
    user: { findUnique: jest.Mock };
  };
  let rulesEngine: { evaluate: jest.Mock };

  const product = {
    id: 1,
    name: 'Producto Test',
    sku: 'SKU-1',
    targetPrice: 1000,
    tolerance: 2,
  } as unknown as Product;

  const retailerUrl = {
    id: 10,
    productId: 1,
    retailerName: 'Retailer',
    url: 'https://example.com/producto',
  } as RetailerUrl;

  const capture = {
    id: 100,
    retailerUrlId: 10,
    currentPrice: 900,
    struckPrice: null,
    promoText: null,
    promoType: null,
    discountPct: null,
    checkResult: 'deviation',
  } as unknown as PriceCapture;

  const rule = {
    id: 50,
    productId: 1,
    ruleType: 'exact_price',
    minPrice: null,
    maxPrice: null,
    allowPromos: false,
    maxDiscountPct: null,
    severity: 'warning',
    isActive: true,
  } as unknown as MonitoringRule;

  const makeAlert = (overrides: Partial<Alert> = {}): Alert =>
    ({
      id: 1,
      productId: 1,
      retailerUrlId: 10,
      type: 'price_below',
      severity: 'warning',
      status: 'open',
      detectedValue: 900,
      expectedValue: 1000,
      description: 'Precio fuera de regla',
      comment: null,
      resolutionComment: null,
      resolvedAt: null,
      assignedUserId: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      ...overrides,
    }) as unknown as Alert;

  beforeEach(() => {
    prisma = {
      monitoringRule: { findMany: jest.fn() },
      alert: {
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
      },
      user: { findUnique: jest.fn() },
    };
    rulesEngine = { evaluate: jest.fn() };
    service = new AlertsService(prisma as never, rulesEngine as never);
  });

  it('crea una alerta cuando el motor devuelve una violacion', async () => {
    prisma.monitoringRule.findMany.mockResolvedValue([rule]);
    rulesEngine.evaluate.mockReturnValue([
      {
        ruleId: 50,
        ruleType: 'exact_price',
        alertType: 'price_below',
        severity: 'warning',
        detectedValue: 900,
        expectedValue: 1000,
        reason: 'Precio por debajo del objetivo.',
      },
    ]);
    prisma.alert.findMany.mockResolvedValue([]);
    prisma.alert.create.mockImplementation(({ data }) =>
      Promise.resolve(makeAlert(data)),
    );

    const result = await service.createFromCapture(
      capture,
      retailerUrl,
      product,
    );

    expect(prisma.monitoringRule.findMany).toHaveBeenCalledWith({
      where: { productId: 1, isActive: true },
    });
    expect(rulesEngine.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ currentPrice: 900 }),
      expect.objectContaining({ targetPrice: 1000, tolerance: 2 }),
      [expect.objectContaining({ id: 50, ruleType: 'exact_price' })],
    );
    expect(prisma.alert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 1,
        retailerUrlId: 10,
        type: 'price_below',
        severity: 'warning',
        status: 'open',
        detectedValue: 900,
        expectedValue: 1000,
        description: 'Precio por debajo del objetivo.',
      }),
    });
    expect(result).toHaveLength(1);
  });

  it('no crea duplicado si existe alerta open del mismo tipo', async () => {
    prisma.monitoringRule.findMany.mockResolvedValue([rule]);
    rulesEngine.evaluate.mockReturnValue([
      {
        ruleId: 50,
        ruleType: 'exact_price',
        alertType: 'price_below',
        severity: 'warning',
        detectedValue: 900,
        expectedValue: 1000,
        reason: 'Precio por debajo del objetivo.',
      },
    ]);
    prisma.alert.findMany.mockResolvedValue([{ type: 'price_below' }]);

    const result = await service.createFromCapture(
      capture,
      retailerUrl,
      product,
    );

    expect(prisma.alert.findMany).toHaveBeenCalledWith({
      where: {
        productId: 1,
        retailerUrlId: 10,
        status: 'open',
        type: { in: ['price_below'] },
      },
      select: { type: true },
    });
    expect(prisma.alert.create).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('crea una nueva alerta si no hay duplicado open', async () => {
    prisma.monitoringRule.findMany.mockResolvedValue([rule]);
    rulesEngine.evaluate.mockReturnValue([
      {
        ruleId: 50,
        ruleType: 'exact_price',
        alertType: 'price_below',
        severity: 'warning',
        detectedValue: 900,
        expectedValue: 1000,
        reason: 'Problema reincidente.',
      },
    ]);
    prisma.alert.findMany.mockResolvedValue([]);
    prisma.alert.create.mockResolvedValue(
      makeAlert({ description: 'Problema reincidente.' }),
    );

    const result = await service.createFromCapture(
      capture,
      retailerUrl,
      product,
    );

    expect(prisma.alert.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      expect.objectContaining({ description: 'Problema reincidente.' }),
    ]);
  });

  it('setea resolvedAt al resolver una alerta', async () => {
    prisma.alert.findUnique.mockResolvedValue({ id: 1 });
    prisma.alert.update.mockImplementation(({ data }) =>
      Promise.resolve(
        makeAlert({ status: data.status, resolvedAt: data.resolvedAt }),
      ),
    );

    const result = await service.updateStatus(1, {
      status: 'resolved',
      resolutionComment: 'Corregido.',
    });

    expect(prisma.alert.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: 'resolved',
        resolvedAt: expect.any(Date),
        resolutionComment: 'Corregido.',
      }),
      include: expect.any(Object),
    });
    expect(result).toEqual(
      expect.objectContaining({
        status: 'resolved',
        resolvedAt: expect.any(Date),
      }),
    );
  });

  it('limpia resolvedAt al mover una alerta a un estado no resuelto', async () => {
    prisma.alert.findUnique.mockResolvedValue({ id: 1 });
    prisma.alert.update.mockResolvedValue(makeAlert({ status: 'in_review' }));

    await service.updateStatus(1, { status: 'in_review' });

    expect(prisma.alert.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: 'in_review',
        resolvedAt: null,
      }),
      include: expect.any(Object),
    });
  });

  it('lanza NotFoundException si la alerta no existe al actualizar', async () => {
    prisma.alert.findUnique.mockResolvedValue(null);

    await expect(
      service.updateStatus(404, { status: 'resolved' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('aplica filtros y paginacion en findAll', async () => {
    prisma.alert.findMany.mockResolvedValue([makeAlert()]);
    prisma.alert.count.mockResolvedValue(1);

    const result = await service.findAll({
      productId: 1,
      retailerUrlId: 10,
      severity: 'warning',
      status: 'open',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-30T23:59:59.999Z',
      page: 3,
      limit: 5,
    });

    expect(prisma.alert.findMany).toHaveBeenCalledWith({
      where: {
        productId: 1,
        retailerUrlId: 10,
        severity: 'warning',
        status: 'open',
        createdAt: {
          gte: new Date('2026-04-01T00:00:00.000Z'),
          lte: new Date('2026-04-30T23:59:59.999Z'),
        },
      },
      skip: 10,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: expect.any(Object),
    });
    expect(result).toEqual({
      data: [expect.objectContaining({ id: 1 })],
      total: 1,
      page: 3,
      limit: 5,
      totalPages: 1,
    });
  });

  it('devuelve summary con ceros por defecto', async () => {
    prisma.alert.count.mockResolvedValue(4);
    prisma.alert.groupBy
      .mockResolvedValueOnce([
        { severity: 'critical', _count: { _all: 2 } },
        { severity: 'warning', _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { status: 'open', _count: { _all: 3 } },
        { status: 'resolved', _count: { _all: 1 } },
      ]);

    await expect(service.getSummary()).resolves.toEqual({
      total: 4,
      bySeverity: { info: 0, warning: 1, critical: 2 },
      byStatus: { open: 3, in_review: 0, resolved: 1, dismissed: 0 },
    });
  });
});
