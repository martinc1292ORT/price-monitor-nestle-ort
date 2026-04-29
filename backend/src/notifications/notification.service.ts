import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type {
  Alert,
  Product,
  RetailerUrl,
} from '../../generated/prisma/client.js';

export interface AlertEmailContext {
  alert: Alert;
  product: Pick<Product, 'name' | 'sku' | 'targetPrice'>;
  retailerUrl: Pick<RetailerUrl, 'retailerName' | 'url'>;
}

const SEVERITY_COLORS: Record<string, string> = {
  warning: '#f59e0b',
  critical: '#dc2626',
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly isConfigured: boolean;
  private readonly transporter: nodemailer.Transporter | null = null;

  constructor() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    this.isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

    if (this.isConfigured) {
      const port = Number(SMTP_PORT ?? 587);
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
    }
  }

  async sendAlert(ctx: AlertEmailContext): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      this.logger.warn(
        `SMTP not configured — alert #${ctx.alert.id} (${ctx.alert.severity}): ` +
          `${ctx.product.name} @ ${ctx.retailerUrl.retailerName} | ` +
          `detected=${ctx.alert.detectedValue?.toString() ?? 'N/A'} ` +
          `expected=${ctx.alert.expectedValue?.toString() ?? 'N/A'}`,
      );
      return;
    }

    const subject =
      `[${ctx.alert.severity.toUpperCase()}] Alerta de Precio: ` +
      `${ctx.product.name} en ${ctx.retailerUrl.retailerName}`;

    try {
      await this.transporter.sendMail({
        from: process.env.ALERT_EMAIL_FROM,
        to: process.env.ALERT_EMAIL_TO,
        subject,
        html: this.buildHtml(ctx),
      });
      this.logger.log(
        `Alert email sent for alert #${ctx.alert.id} (${ctx.alert.severity})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send alert email for alert #${ctx.alert.id}: ${String(err)}`,
      );
    }
  }

  buildHtml(ctx: AlertEmailContext): string {
    const { alert, product, retailerUrl } = ctx;
    const color = SEVERITY_COLORS[alert.severity] ?? '#6b7280';
    const severityLabel =
      alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1);
    const detectedPrice = alert.detectedValue?.toString() ?? 'N/A';
    const expectedPrice =
      alert.expectedValue?.toString() ?? product.targetPrice?.toString() ?? 'N/A';
    const alertDate = new Date(alert.createdAt).toLocaleString('es-AR');

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:16px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.12)">
    <div style="background:${color};padding:20px 24px">
      <h1 style="color:#fff;margin:0;font-size:18px">Alerta de Precio — ${severityLabel}</h1>
    </div>
    <div style="padding:24px">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:8px 0;color:#666;width:40%">Producto</td>
          <td style="padding:8px 0;font-weight:bold">${product.name} (${product.sku})</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#666">Retailer</td>
          <td style="padding:8px 0">${retailerUrl.retailerName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#666">Precio detectado</td>
          <td style="padding:8px 0;color:${color};font-size:20px;font-weight:bold">$${detectedPrice}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#666">Precio esperado</td>
          <td style="padding:8px 0">$${expectedPrice}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#666">Tipo de alerta</td>
          <td style="padding:8px 0">${alert.type}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#666">Descripción</td>
          <td style="padding:8px 0">${alert.description ?? ''}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#666">URL</td>
          <td style="padding:8px 0"><a href="${retailerUrl.url}" style="color:#0066cc">${retailerUrl.url}</a></td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#666">Fecha</td>
          <td style="padding:8px 0">${alertDate}</td>
        </tr>
      </table>
    </div>
    <div style="background:#f0f0f0;padding:12px 24px;font-size:12px;color:#999">
      Price Monitor — Alerta automática. ID #${alert.id}
    </div>
  </div>
</body>
</html>`;
  }
}
