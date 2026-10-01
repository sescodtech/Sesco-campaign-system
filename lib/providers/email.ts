import type { EmailMessage, EmailProvider, SendResult } from "./types";

type Config = { apiKey: string; apiSecret?: string };

async function jsonFetch(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.text();
  if (!response.ok) throw new Error(body || `Provider request failed (${response.status})`);
  return body ? JSON.parse(body) : {};
}

export class BrevoProvider implements EmailProvider {
  readonly name = "brevo" as const;
  constructor(private config: Config) {}
  async validateConfiguration() {
    try {
      await jsonFetch("https://api.brevo.com/v3/account", { headers: { "api-key": this.config.apiKey, accept: "application/json" } });
      return { ok: true, message: "Brevo connection verified." };
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Brevo verification failed." }; }
  }
  async sendEmail(message: EmailMessage): Promise<SendResult> {
    const result = await jsonFetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST", headers: { "api-key": this.config.apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { name: message.fromName, email: message.fromEmail }, to: [{ email: message.to }], subject: message.subject, htmlContent: message.html, replyTo: message.replyTo ? { email: message.replyTo } : undefined }),
    });
    return { providerMessageId: result.messageId };
  }
}

export class ResendProvider implements EmailProvider {
  readonly name = "resend" as const;
  constructor(private config: Config) {}
  async validateConfiguration() {
    try {
      await jsonFetch("https://api.resend.com/domains", { headers: { authorization: `Bearer ${this.config.apiKey}` } });
      return { ok: true, message: "Resend connection verified." };
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Resend verification failed." }; }
  }
  async sendEmail(message: EmailMessage): Promise<SendResult> {
    const result = await jsonFetch("https://api.resend.com/emails", {
      method: "POST", headers: { authorization: `Bearer ${this.config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: `${message.fromName} <${message.fromEmail}>`, to: [message.to], subject: message.subject, html: message.html, reply_to: message.replyTo || undefined }),
    });
    return { providerMessageId: result.id };
  }
}

export class MailjetProvider implements EmailProvider {
  readonly name = "mailjet" as const;
  constructor(private config: Config) {}
  private auth() { return `Basic ${Buffer.from(`${this.config.apiKey}:${this.config.apiSecret || ""}`).toString("base64")}`; }
  async validateConfiguration() {
    try {
      await jsonFetch("https://api.mailjet.com/v3/REST/myprofile", { headers: { authorization: this.auth() } });
      return { ok: true, message: "Mailjet connection verified." };
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Mailjet verification failed." }; }
  }
  async sendEmail(message: EmailMessage): Promise<SendResult> {
    const result = await jsonFetch("https://api.mailjet.com/v3.1/send", {
      method: "POST", headers: { authorization: this.auth(), "content-type": "application/json" },
      body: JSON.stringify({ Messages: [{ From: { Email: message.fromEmail, Name: message.fromName }, To: [{ Email: message.to }], Subject: message.subject, HTMLPart: message.html, ReplyTo: message.replyTo ? { Email: message.replyTo } : undefined }] }),
    });
    return { providerMessageId: String(result.Messages?.[0]?.To?.[0]?.MessageID ?? result.Messages?.[0]?.To?.[0]?.MessageUUID ?? crypto.randomUUID()) };
  }
}

export function makeEmailProvider(provider: string, config: Config): EmailProvider {
  if (provider === "brevo") return new BrevoProvider(config);
  if (provider === "resend") return new ResendProvider(config);
  if (provider === "mailjet") return new MailjetProvider(config);
  throw new Error(`Unsupported email provider: ${provider}`);
}
