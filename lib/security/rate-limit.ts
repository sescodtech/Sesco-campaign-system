import { createAdminClient } from "@/lib/supabase/admin";

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_rate_limit", { p_key:key, p_limit:limit, p_window_seconds:windowSeconds });
  if (error) throw new Error(`Rate-limit check failed: ${error.message}`);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.allowed) {
    const error = new Error("Too many requests. Please retry later.") as Error & { status?:number; resetAt?:string };
    error.status = 429; error.resetAt = result?.reset_at;
    throw error;
  }
  return result as { allowed:boolean; remaining:number; reset_at:string };
}
