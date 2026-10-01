import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function key() {
  const source = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!source) throw new Error("INTEGRATION_ENCRYPTION_KEY is not configured.");
  return createHash("sha256").update(source).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(payload: string) {
  const [ivRaw, tagRaw, dataRaw] = payload.split(".");
  if (!ivRaw || !tagRaw || !dataRaw) throw new Error("Invalid encrypted secret.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, "base64url")), decipher.final()]).toString("utf8");
}
