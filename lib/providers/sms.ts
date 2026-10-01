import type { SendResult, SmsMessage, SmsProvider } from "./types";

type TermiiConfig = { apiKey: string; baseUrl: string; senderId: string; route?: string };
type CustomSmsConfig = { endpoint: string; bearerToken?: string; senderId: string };

async function jsonFetch(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(body?.message || body?.error || text || `SMS provider request failed (${response.status})`);
  return body;
}

export class TermiiProvider implements SmsProvider {
  readonly name = "termii" as const;
  constructor(private config: TermiiConfig) {}
  private base() { return this.config.baseUrl.replace(/\/$/, ""); }
  async validateConfiguration() {
    if (!this.config.apiKey || !this.config.baseUrl || !this.config.senderId) return { ok:false, message:"Termii API key, base URL and sender ID are required." };
    try {
      // Termii exposes balance on regional base URLs and it is safe for a connection check.
      await jsonFetch(`${this.base()}/api/get-balance?api_key=${encodeURIComponent(this.config.apiKey)}`, { headers:{ accept:"application/json" } });
      return { ok:true, message:"Termii connection verified." };
    } catch (error) { return { ok:false, message:error instanceof Error ? error.message : "Termii verification failed." }; }
  }
  async sendSms(message: SmsMessage): Promise<SendResult> {
    const result = await jsonFetch(`${this.base()}/api/sms/send`, {
      method:"POST", headers:{"content-type":"application/json",accept:"application/json"},
      body:JSON.stringify({ api_key:this.config.apiKey, to:message.to, from:message.senderId || this.config.senderId, sms:message.body, type:"plain", channel:this.config.route || "generic" }),
    });
    const id = String(result.message_id ?? result.messageId ?? result.request_id ?? crypto.randomUUID());
    return { providerMessageId:id, raw:result };
  }
}

export class CustomSmsProvider implements SmsProvider {
  readonly name = "custom_sms" as const;
  constructor(private config: CustomSmsConfig) {}
  async validateConfiguration() {
    if (!this.config.endpoint || !this.config.senderId) return { ok:false, message:"Endpoint and sender ID are required." };
    return { ok:true, message:"Custom SMS configuration saved. Send a test campaign to validate the provider-specific payload." };
  }
  async sendSms(message: SmsMessage): Promise<SendResult> {
    const result = await jsonFetch(this.config.endpoint, {
      method:"POST",
      headers:{"content-type":"application/json",...(this.config.bearerToken?{authorization:`Bearer ${this.config.bearerToken}`}:{})},
      body:JSON.stringify({ to:message.to, message:message.body, body:message.body, sender:message.senderId || this.config.senderId }),
    });
    return { providerMessageId:String(result.message_id ?? result.messageId ?? result.id ?? crypto.randomUUID()), raw:result };
  }
}

export function makeSmsProvider(provider: string, config: any): SmsProvider {
  if (provider === "termii") return new TermiiProvider(config);
  if (provider === "custom_sms") return new CustomSmsProvider(config);
  throw new Error(`Unsupported SMS provider: ${provider}`);
}
