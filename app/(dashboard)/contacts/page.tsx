import Link from "next/link";
import { Search, Upload, UserRoundPlus } from "lucide-react";
import { ContactSubnav } from "@/components/contacts/contact-subnav";
import { getCurrentContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { maskAccountNumber } from "@/lib/contacts/fields";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const context = await getCurrentContext();
  const orgId = context?.membership?.organization_id as string;
  const supabase = await createClient();
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase.from("contacts").select("id,full_name,email,phone,account_number,branch,customer_type,customer_status,is_active,created_at", { count: "exact" }).eq("organization_id", orgId).order("created_at", { ascending: false }).range(from, to);
  if (params.q?.trim()) {
    const term = params.q.trim().replace(/[,%]/g, "");
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,account_number.ilike.%${term}%`);
  }
  const { data: contacts, count } = await query;
  const pages = Math.max(1, Math.ceil((count || 0) / pageSize));

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Audience</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Contacts</h1><p className="mt-1 text-sm text-slate-500">Your organization-wide customer and prospect database.</p></div><div className="flex gap-2"><Link href="/contacts/imports" className="btn-secondary"><Upload className="size-4"/>Import</Link><button className="btn-primary"><UserRoundPlus className="size-4"/>Add contact</button></div></div>
    <ContactSubnav/>
    <div className="panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><form className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input name="q" defaultValue={params.q || ""} className="field pl-9" placeholder="Search name, email, phone or account…"/></form><div className="text-sm text-slate-500">{count || 0} contacts</div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3">Account</th><th className="px-5 py-3">Branch</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">
      {(contacts || []).map((c) => <tr key={c.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><Link href={`/contacts/${c.id}`} className="font-semibold text-slate-900 hover:underline">{c.full_name || "Unnamed contact"}</Link><div className="text-xs text-slate-500">{c.email || "No email"}</div></td><td className="px-5 py-4 text-slate-600">{c.phone || "—"}</td><td className="px-5 py-4 font-mono text-xs text-slate-600">{maskAccountNumber(c.account_number)}</td><td className="px-5 py-4 text-slate-600">{c.branch || "—"}</td><td className="px-5 py-4 text-slate-600">{c.customer_type || "—"}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{c.customer_status || (c.is_active ? "Active" : "Inactive")}</span></td></tr>)}
      {!contacts?.length && <tr><td colSpan={6} className="px-5 py-16 text-center"><div className="font-semibold">No contacts yet</div><div className="mt-1 text-sm text-slate-500">Import an Excel/CSV file to create your customer database.</div><Link href="/contacts/imports" className="btn-primary mt-5">Start an import</Link></td></tr>}
      </tbody></table></div>
      {pages > 1 && <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm"><span className="text-slate-500">Page {page} of {pages}</span><div className="flex gap-2"><Link className={`btn-secondary ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={`/contacts?page=${page-1}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}>Previous</Link><Link className={`btn-secondary ${page >= pages ? "pointer-events-none opacity-40" : ""}`} href={`/contacts?page=${page+1}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}>Next</Link></div></div>}
    </div>
  </div>;
}
