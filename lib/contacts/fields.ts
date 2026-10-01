export const contactFields = [
  ["external_customer_id", "Customer ID"],
  ["account_number", "Account Number"],
  ["first_name", "First Name"],
  ["last_name", "Last Name"],
  ["full_name", "Full Name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["whatsapp_phone", "WhatsApp Phone"],
  ["gender", "Gender"],
  ["country", "Country"],
  ["state", "State"],
  ["city", "City"],
  ["branch", "Branch"],
  ["account_type", "Account Type"],
  ["customer_type", "Customer Type"],
  ["customer_status", "Customer Status"],
  ["relationship_manager", "Relationship Manager"],
  ["date_joined", "Date Joined"],
  ["last_transaction_date", "Last Transaction Date"],
  ["balance_band", "Balance Band"],
] as const;

export type ContactFieldKey = (typeof contactFields)[number][0];

export const maskAccountNumber = (value?: string | null) => {
  if (!value) return "—";
  const cleaned = value.replace(/\s/g, "");
  if (cleaned.length <= 4) return `••••${cleaned}`;
  return `${"•".repeat(Math.min(6, cleaned.length - 4))}${cleaned.slice(-4)}`;
};

export const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() || null;
export const normalizePhone = (value?: string | null) => value?.trim().replace(/[^0-9+]/g, "") || null;
