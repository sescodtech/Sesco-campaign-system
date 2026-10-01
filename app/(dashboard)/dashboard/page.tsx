import { Activity, CircleCheck, ContactRound, MailCheck, Megaphone, MousePointerClick } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/lib/auth/context";

export const metadata = { title: "Overview" };

export default async function DashboardPage() {
  const context = await getCurrentContext();
  const orgId = context?.membership?.organization_id;
  let totalContacts=0, activeContacts=0, campaignCount=0;
  let totals={delivered:0,opened:0,clicked:0};
  if(orgId){
    const supabase=await createClient();
    const [allQ,activeQ,campaignQ,metricQ]=await Promise.all([
      supabase.from("contacts").select("id",{count:"exact",head:true}).eq("organization_id",orgId),
      supabase.from("contacts").select("id",{count:"exact",head:true}).eq("organization_id",orgId).eq("is_active",true),
      supabase.from("campaigns").select("id",{count:"exact",head:true}).eq("organization_id",orgId),
      supabase.from("campaign_metrics").select("delivered,opened,clicked").eq("organization_id",orgId),
    ]);
    totalContacts=allQ.count??0; activeContacts=activeQ.count??0; campaignCount=campaignQ.count??0;
    totals=(metricQ.data??[]).reduce((a,r)=>({delivered:a.delivered+(r.delivered??0),opened:a.opened+(r.opened??0),clicked:a.clicked+(r.clicked??0)}),totals);
  }
  const openRate=totals.delivered?`${(totals.opened/totals.delivered*100).toFixed(1)}%`:"0%";
  const clickRate=totals.delivered?`${(totals.clicked/totals.delivered*100).toFixed(1)}%`:"0%";
  const cards = [
    ["Total Contacts", String(totalContacts), "Central audience database", ContactRound],
    ["Active Contacts", String(activeContacts), "Eligible active records", CircleCheck],
    ["Campaigns", String(campaignCount), "All campaign records", Megaphone],
    ["Emails Delivered", String(totals.delivered), "Recorded provider deliveries", MailCheck],
    ["Average Open Rate", openRate, "Across recorded deliveries", Activity],
    ["Average Click Rate", clickRate, "Across recorded deliveries", MousePointerClick],
  ] as const;
  return <div className="mx-auto max-w-[1500px] space-y-6"><section><p className="eyebrow">Command center</p><div className="mt-1 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h2 className="text-3xl font-semibold tracking-[-.04em]">Campaign operations at a glance</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Monitor audience health, delivery performance and workspace readiness from one controlled view.</p></div><button className="btn-primary">Create campaign</button></div></section><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([l,v,n,i])=><MetricCard key={l} label={l} value={v} note={n} icon={i}/>)}</section><section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]"><div className="panel p-6"><div className="flex items-center justify-between"><div><p className="font-semibold">Campaign performance</p><p className="mt-1 text-sm text-slate-500">Delivery trend will populate as campaigns run.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Last 30 days</span></div><div className="mt-8 grid h-64 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50"><div className="text-center"><Activity className="mx-auto size-7 text-slate-300"/><p className="mt-3 text-sm font-semibold">No delivery data yet</p><p className="mt-1 text-xs text-slate-400">Performance will appear after your first campaign.</p></div></div></div><div className="panel p-6"><p className="font-semibold">Workspace readiness</p><div className="mt-5 space-y-4">{[["Authentication","Ready"],["Organization isolation","Ready"],["Roles & permissions","Ready"],["Email providers","Ready"],["Campaign engine","Ready"]].map(([a,b])=><div key={a} className="flex items-center justify-between border-b border-slate-100 pb-3 text-sm last:border-0"><span className="text-slate-600">{a}</span><span className={`font-semibold ${b==="Ready"?"text-emerald-600":"text-slate-500"}`}>{b}</span></div>)}</div></div></section></div>;
}
