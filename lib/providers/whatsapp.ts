import type { SendResult, WhatsAppProvider, WhatsAppTemplateMessage } from "./types";

type MetaConfig = { accessToken: string; phoneNumberId: string; graphVersion: string };

async function jsonFetch(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw:text }; }
  if (!response.ok) throw new Error(body?.error?.message || text || `WhatsApp provider request failed (${response.status})`);
  return body;
}

export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly name = "meta_whatsapp" as const;
  constructor(private config: MetaConfig) {}
  private base() { return `https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}`; }
  async validateConfiguration() {
    if (!this.config.accessToken || !this.config.phoneNumberId || !this.config.graphVersion) return { ok:false, message:"Access token, Phone Number ID and Graph API version are required." };
    try {
      await jsonFetch(`${this.base()}?fields=display_phone_number,verified_name`, { headers:{authorization:`Bearer ${this.config.accessToken}`} });
      return { ok:true, message:"WhatsApp Cloud API connection verified." };
    } catch (error) { return { ok:false, message:error instanceof Error?error.message:"WhatsApp verification failed." }; }
  }
  async sendTemplate(message: WhatsAppTemplateMessage): Promise<SendResult> {
    const result = await jsonFetch(`${this.base()}/messages`, {
      method:"POST",
      headers:{authorization:`Bearer ${this.config.accessToken}`,"content-type":"application/json"},
      body:JSON.stringify({ messaging_product:"whatsapp", to:message.to, type:"template", template:{ name:message.templateName, language:{code:message.language}, ...(message.components?.length?{components:message.components}:{}) } }),
    });
    return { providerMessageId:String(result.messages?.[0]?.id ?? crypto.randomUUID()), raw:result };
  }
}

export function makeWhatsAppProvider(provider: string, config: MetaConfig): WhatsAppProvider {
  if (provider === "meta_whatsapp") return new MetaWhatsAppProvider(config);
  throw new Error(`Unsupported WhatsApp provider: ${provider}`);
}
