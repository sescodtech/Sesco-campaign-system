"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, BarChart3, BookOpenText, ContactRound, LayoutDashboard, Menu, Megaphone, PlugZap, Settings2, ShieldCheck, UsersRound, Workflow, X } from "lucide-react";

const items = [
  ["Overview", "/dashboard", LayoutDashboard], ["Campaigns", "/campaigns", Megaphone], ["Contacts", "/contacts", ContactRound], ["Templates", "/templates", BookOpenText], ["Automation", "/automation", Workflow], ["Analytics", "/analytics", BarChart3], ["Integrations", "/integrations", PlugZap], ["Team & Roles", "/team", UsersRound], ["Audit Logs", "/audit", Activity], ["Settings", "/settings", Settings2],
] as const;

export function MobileSidebar({ organizationName }: { organizationName: string }) {
  const [open,setOpen]=useState(false); const pathname=usePathname();
  return <>
    <button onClick={()=>setOpen(true)} className="fixed bottom-5 right-5 z-40 grid size-12 place-items-center rounded-2xl bg-slate-950 text-white shadow-xl lg:hidden" aria-label="Open navigation"><Menu className="size-5"/></button>
    {open && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation overlay" className="absolute inset-0 bg-slate-950/40" onClick={()=>setOpen(false)}/><aside className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] bg-white shadow-2xl"><div className="flex h-20 items-center justify-between border-b px-5"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-slate-950 text-white"><ShieldCheck className="size-5"/></div><div><div className="text-sm font-bold">CampaignOS</div><div className="max-w-40 truncate text-xs text-slate-500">{organizationName}</div></div></div><button onClick={()=>setOpen(false)} className="grid size-10 place-items-center rounded-xl border"><X className="size-4"/></button></div><nav className="space-y-1 p-3">{items.map(([label,href,Icon])=>{const active=href==="/dashboard"?pathname===href:pathname.startsWith(href); return <Link onClick={()=>setOpen(false)} key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${active?"bg-slate-950 text-white":"text-slate-600 hover:bg-slate-100"}`}><Icon className="size-[18px]"/>{label}</Link>})}</nav></aside></div>}
  </>
}
