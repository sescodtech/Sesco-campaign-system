import { ContactSubnav } from "@/components/contacts/contact-subnav";
import { getCurrentContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { createList, createTag } from "./actions";

const tagClasses: Record<string,string> = { slate:"bg-slate-100 text-slate-700", blue:"bg-blue-50 text-blue-700", emerald:"bg-emerald-50 text-emerald-700", amber:"bg-amber-50 text-amber-700", rose:"bg-rose-50 text-rose-700", violet:"bg-violet-50 text-violet-700" };

export default async function ListsPage() {
  const context = await getCurrentContext(); const orgId = context?.membership?.organization_id as string; const supabase = await createClient();
  const [{ data: lists }, { data: tags }] = await Promise.all([
    supabase.from("contact_lists").select("id,name,description,created_at,contact_list_members(count)").eq("organization_id",orgId).order("created_at",{ascending:false}),
    supabase.from("tags").select("id,name,color,contact_tags(count)").eq("organization_id",orgId).order("name"),
  ]);
  return <div className="space-y-6"><div><p className="eyebrow">Contacts</p><h1 className="mt-1 text-2xl font-bold">Lists & tags</h1><p className="mt-1 text-sm text-slate-500">Organize contacts into reusable audiences and lightweight classifications.</p></div><ContactSubnav/>
  <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
    <section className="panel overflow-hidden"><div className="border-b border-slate-200 p-5"><h2 className="font-bold">Contact lists</h2><p className="mt-1 text-sm text-slate-500">Static audiences you can use in campaigns.</p></div><form action={createList} className="grid gap-3 border-b border-slate-200 bg-slate-50/60 p-5 sm:grid-cols-[1fr_1.4fr_auto]"><input name="name" required className="field" placeholder="List name"/><input name="description" className="field" placeholder="Description (optional)"/><button className="btn-primary">Create list</button></form><div className="divide-y divide-slate-100">{(lists||[]).map((list)=>{const count=(list.contact_list_members as unknown as Array<{count:number}>)?.[0]?.count || 0;return <div key={list.id} className="flex items-center justify-between gap-4 p-5"><div><div className="font-semibold">{list.name}</div><div className="mt-1 text-sm text-slate-500">{list.description || "No description"}</div></div><div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{count} contacts</div></div>})}{!lists?.length&&<div className="p-10 text-center text-sm text-slate-500">No lists created yet.</div>}</div></section>
    <section className="panel overflow-hidden"><div className="border-b border-slate-200 p-5"><h2 className="font-bold">Tags</h2><p className="mt-1 text-sm text-slate-500">Reusable labels for contact records.</p></div><form action={createTag} className="space-y-3 border-b border-slate-200 bg-slate-50/60 p-5"><input name="name" required className="field" placeholder="Tag name"/><div className="flex gap-2"><select name="color" className="field"><option value="slate">Slate</option><option value="blue">Blue</option><option value="emerald">Emerald</option><option value="amber">Amber</option><option value="rose">Rose</option><option value="violet">Violet</option></select><button className="btn-primary shrink-0">Add tag</button></div></form><div className="flex flex-wrap gap-2 p-5">{(tags||[]).map(tag=><span key={tag.id} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tagClasses[tag.color]||tagClasses.slate}`}>{tag.name}</span>)}{!tags?.length&&<span className="text-sm text-slate-500">No tags yet.</span>}</div></section>
  </div></div>;
}
