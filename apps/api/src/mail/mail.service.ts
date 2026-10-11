import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { CONFIG } from '../common/core.module';
import type { AppConfig } from '../config';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Correos solo en texto plano: sin HTML, sin imágenes remotas, sin píxeles de seguimiento.
 * Nunca se registra el contenido ni el destinatario en los logs.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private transport: Transporter | null = null;
  private readonly outbox: (OutgoingMail & { at: string })[] = [];

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    if (config.MAIL_MODE === 'smtp' && config.SMTP_URL) {
      this.transport = nodemailer.createTransport(config.SMTP_URL);
    }
  }

  async send(mail: OutgoingMail): Promise<boolean> {
    if (this.config.MAIL_MODE === 'outbox') {
      this.outbox.push({ ...mail, at: new Date().toISOString() });
      if (this.outbox.length > 500) this.outbox.shift();
      return true;
    }
    try {
      await this.transport!.sendMail({
        from: this.config.MAIL_FROM,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
      });
      return true;
    } catch (err) {
      // Sin destinatario ni contenido en el log.
      this.logger.error(`Fallo de envío SMTP: ${(err as Error).name}`);
      return false;
    }
  }

  /** Solo para desarrollo y pruebas (MAIL_MODE=outbox). */
  readOutbox(to?: string) {
    return to ? this.outbox.filter((m) => m.to === to) : [...this.outbox];
  }
}
