import { ContactSubnav } from "@/components/contacts/contact-subnav";
import { ImportWizard } from "@/components/imports/import-wizard";
import { getCurrentContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export default async function ImportsPage() {
  const context = await getCurrentContext();
  const orgId = context?.membership?.organization_id as string;
  const supabase = await createClient();
  const { data: history } = await supabase.from("imports").select("id,filename,status,total_rows,valid_rows,invalid_rows,duplicate_rows,new_rows,updated_rows,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(10);
  return <div className="space-y-6"><div><p className="eyebrow">Contacts</p><h1 className="mt-1 text-2xl font-bold">Import contacts</h1><p className="mt-1 text-sm text-slate-500">Upload, preview, map, validate and safely merge spreadsheet records.</p></div><ContactSubnav/><ImportWizard/>
  <div className="panel overflow-hidden"><div className="border-b border-slate-200 p-5"><h2 className="font-bold">Recent imports</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">File</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Rows</th><th className="px-5 py-3">Valid</th><th className="px-5 py-3">Invalid</th><th className="px-5 py-3">New</th><th className="px-5 py-3">Updated</th><th className="px-5 py-3">Date</th></tr></thead><tbody className="divide-y divide-slate-100">{(history||[]).map(i=><tr key={i.id}><td className="px-5 py-3 font-medium">{i.filename}</td><td className="px-5 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize">{i.status}</span></td><td className="px-5 py-3">{i.total_rows}</td><td className="px-5 py-3">{i.valid_rows}</td><td className="px-5 py-3">{i.invalid_rows}</td><td className="px-5 py-3">{i.new_rows}</td><td className="px-5 py-3">{i.updated_rows}</td><td className="px-5 py-3 text-slate-500">{new Date(i.created_at).toLocaleDateString()}</td></tr>)}{!history?.length&&<tr><td colSpan={8} className="px-5 py-10 text-center text-slate-500">No imports yet.</td></tr>}</tbody></table></div></div></div>;
}
