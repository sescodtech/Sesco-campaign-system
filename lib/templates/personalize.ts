export const personalizationVariables = [
  "first_name","last_name","full_name","email","phone","branch","account_type","masked_account_number"
] as const;

export function personalize(input: string, values: Record<string,string>) {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)(?:\s*\|\s*default:\s*"([^"]*)")?\s*\}\}/g, (_match, key: string, fallback?: string) => values[key] || fallback || "");
}
