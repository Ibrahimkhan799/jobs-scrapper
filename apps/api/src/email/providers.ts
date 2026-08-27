import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import { env } from '../env.js';

export type EmailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
};

export type EmailSendResult = {
  messageId: string;
  accepted: string[];
  rejected: string[];
};

export interface EmailProvider {
  id: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export class SmtpProvider implements EmailProvider {
  id = 'smtp';
  constructor(private readonly options: SMTPTransport.Options) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const transport = nodemailer.createTransport(this.options);
    const info = await transport.sendMail({
      from: message.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      attachments: message.attachments,
    });
    return {
      messageId: info.messageId,
      accepted: info.accepted.map(String),
      rejected: info.rejected.map(String),
    };
  }
}

export class GmailProvider extends SmtpProvider {
  id = 'gmail';
  constructor(user: string, password: string) {
    super({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass: password },
    });
  }
}

export class OutlookProvider extends SmtpProvider {
  id = 'outlook';
  constructor(user: string, password: string) {
    super({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: { user, pass: password },
    });
  }
}

export class MemoryEmailProvider implements EmailProvider {
  id = 'memory';
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.sent.push(message);
    return { messageId: `mem-${this.sent.length}`, accepted: [message.to], rejected: [] };
  }
}

let testProvider: EmailProvider | null = null;

export function setEmailProviderForTests(provider: EmailProvider | null): void {
  testProvider = provider;
}

export function envEmailProvider(): EmailProvider | null {
  if (testProvider) return testProvider;
  if (env.SMTP_PROVIDER === 'gmail' && env.SMTP_USER && env.SMTP_PASSWORD) {
    return new GmailProvider(env.SMTP_USER, env.SMTP_PASSWORD);
  }
  if (env.SMTP_PROVIDER === 'outlook' && env.SMTP_USER && env.SMTP_PASSWORD) {
    return new OutlookProvider(env.SMTP_USER, env.SMTP_PASSWORD);
  }
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD) {
    return new SmtpProvider({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });
  }
  return null;
}

export function accountEmailProvider(account: {
  provider: string;
  host: string;
  port: number;
  username: string;
  password: string;
  secure: boolean;
}): EmailProvider {
  if (account.provider === 'gmail') return new GmailProvider(account.username, account.password);
  if (account.provider === 'outlook') return new OutlookProvider(account.username, account.password);
  return new SmtpProvider({
    host: account.host,
    port: account.port,
    secure: account.secure,
    auth: { user: account.username, pass: account.password },
  });
}
