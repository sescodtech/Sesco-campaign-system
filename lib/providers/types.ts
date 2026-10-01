export type SendResult = { providerMessageId: string; raw?: unknown };

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string | null;
};

export type SmsMessage = {
  to: string;
  body: string;
  senderId: string;
};

export type WhatsAppTemplateMessage = {
  to: string;
  templateName: string;
  language: string;
  components?: unknown[];
};

export interface EmailProvider {
  readonly name: "brevo" | "resend" | "mailjet";
  validateConfiguration(): Promise<{ ok: boolean; message: string }>;
  sendEmail(message: EmailMessage): Promise<SendResult>;
}

export interface SmsProvider {
  readonly name: "termii" | "custom_sms";
  validateConfiguration(): Promise<{ ok: boolean; message: string }>;
  sendSms(message: SmsMessage): Promise<SendResult>;
}

export interface WhatsAppProvider {
  readonly name: "meta_whatsapp";
  validateConfiguration(): Promise<{ ok: boolean; message: string }>;
  sendTemplate(message: WhatsAppTemplateMessage): Promise<SendResult>;
}
