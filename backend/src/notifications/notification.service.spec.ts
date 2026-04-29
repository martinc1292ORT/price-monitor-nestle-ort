const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: mockSendMail,
  }),
}));

import { NotificationService, AlertEmailContext } from './notification.service';
import type { Alert, Product, RetailerUrl } from '../../generated/prisma/client.js';

const makeContext = (severity: string = 'warning'): AlertEmailContext => ({
  alert: {
    id: 42,
    severity,
    type: 'price_below',
    status: 'open',
    description: 'Precio por debajo del mínimo',
    detectedValue: { toString: () => '800.00' } as any,
    expectedValue: { toString: () => '1000.00' } as any,
    createdAt: new Date('2026-04-29T10:00:00Z'),
  } as unknown as Alert,
  product: {
    name: 'Nestle Leche',
    sku: 'NES-001',
    targetPrice: { toString: () => '1000.00' } as any,
  } as unknown as Pick<Product, 'name' | 'sku' | 'targetPrice'>,
  retailerUrl: {
    retailerName: 'Carrefour',
    url: 'https://www.carrefour.com.ar/nestle-leche',
  } as Pick<RetailerUrl, 'retailerName' | 'url'>,
});

describe('NotificationService', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue({ messageId: 'test-msg-id' });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('when SMTP is not configured', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = '';
      process.env.SMTP_USER = '';
      process.env.SMTP_PASS = '';
    });

    it('logs a warning and does not call sendMail', async () => {
      const service = new NotificationService();
      const warnSpy = jest
        .spyOn(service['logger'], 'warn')
        .mockImplementation(() => {});

      await service.sendAlert(makeContext('warning'));

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SMTP not configured'),
      );
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('includes the alert id and product name in the warning log', async () => {
      const service = new NotificationService();
      const warnSpy = jest
        .spyOn(service['logger'], 'warn')
        .mockImplementation(() => {});

      await service.sendAlert(makeContext('critical'));

      const logged: string = warnSpy.mock.calls[0][0] as string;
      expect(logged).toContain('#42');
      expect(logged).toContain('Nestle Leche');
    });
  });

  describe('when SMTP is configured', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'secret';
      process.env.ALERT_EMAIL_FROM = 'monitor@example.com';
      process.env.ALERT_EMAIL_TO = 'team@example.com';
    });

    it('calls sendMail for a warning alert with correct to/from', async () => {
      const service = new NotificationService();
      await service.sendAlert(makeContext('warning'));

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mail = mockSendMail.mock.calls[0][0];
      expect(mail.from).toBe('monitor@example.com');
      expect(mail.to).toBe('team@example.com');
    });

    it('subject contains WARNING and product name for warning alert', async () => {
      const service = new NotificationService();
      await service.sendAlert(makeContext('warning'));

      const subject: string = mockSendMail.mock.calls[0][0].subject;
      expect(subject).toContain('WARNING');
      expect(subject).toContain('Nestle Leche');
    });

    it('subject contains CRITICAL for critical alert', async () => {
      const service = new NotificationService();
      await service.sendAlert(makeContext('critical'));

      const subject: string = mockSendMail.mock.calls[0][0].subject;
      expect(subject).toContain('CRITICAL');
    });

    it('does not throw and logs error when sendMail rejects', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));
      const service = new NotificationService();
      const errorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => {});

      await expect(service.sendAlert(makeContext('critical'))).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send alert email'),
      );
    });
  });

  describe('buildHtml', () => {
    let service: NotificationService;

    beforeEach(() => {
      process.env.SMTP_HOST = '';
      service = new NotificationService();
    });

    it('contains all required fields in the HTML output', () => {
      const html = service.buildHtml(makeContext('warning'));

      expect(html).toContain('Nestle Leche');
      expect(html).toContain('NES-001');
      expect(html).toContain('Carrefour');
      expect(html).toContain('https://www.carrefour.com.ar/nestle-leche');
      expect(html).toContain('800.00');
      expect(html).toContain('1000.00');
      expect(html).toContain('#42');
    });

    it('uses amber colour for warning severity', () => {
      const html = service.buildHtml(makeContext('warning'));
      expect(html).toContain('#f59e0b');
    });

    it('uses red colour for critical severity', () => {
      const html = service.buildHtml(makeContext('critical'));
      expect(html).toContain('#dc2626');
    });

    it('renders N/A when detectedValue is null', () => {
      const ctx = makeContext('warning');
      (ctx.alert as any).detectedValue = null;
      const html = service.buildHtml(ctx);
      expect(html).toContain('N/A');
    });
  });
});
