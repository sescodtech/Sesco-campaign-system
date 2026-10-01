import { createHmac, timingSafeEqual } from "crypto";

export function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string) {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected); const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a,b);
}

export function constantTimeTokenEquals(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  const aa=Buffer.from(a); const bb=Buffer.from(b);
  return aa.length===bb.length && timingSafeEqual(aa,bb);
}
