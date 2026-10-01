"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, BookOpenText, ContactRound, LayoutDashboard, Megaphone, PlugZap, Settings2, ShieldCheck, UsersRound, Workflow } from "lucide-react";
const items = [
  ["Overview", "/dashboard", LayoutDashboard], ["Campaigns", "/campaigns", Megaphone], ["Contacts", "/contacts", ContactRound], ["Templates", "/templates", BookOpenText], ["Automation", "/automation", Workflow], ["Analytics", "/analytics", BarChart3], ["Integrations", "/integrations", PlugZap], ["Team & Roles", "/team", UsersRound], ["Audit Logs", "/audit", Activity], ["Settings", "/settings", Settings2],
] as const;
export function Sidebar({ organizationName }: { organizationName: string }) {
  const pathname = usePathname();
  return <aside className="hidden min-h-screen w-[250px] shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col"><div className="flex h-20 items-center gap-3 border-b border-slate-100 px-5"><div className="grid size-10 place-items-center rounded-xl bg-slate-950 text-white"><ShieldCheck className="size-5"/></div><div className="min-w-0"><div className="text-sm font-bold">CampaignOS</div><div className="truncate text-xs text-slate-500">{organizationName}</div></div></div><nav className="flex-1 space-y-1 p-3">{items.map(([label,href,Icon])=>{const active=href==="/dashboard"?pathname===href:pathname.startsWith(href);return <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active?"bg-slate-950 text-white":"text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}><Icon className="size-[18px]"/>{label}</Link>})}</nav><div className="border-t border-slate-100 p-4 text-xs leading-5 text-slate-500">Secure organization workspace<br/><span className="font-medium text-slate-700">Phase 20 Build</span></div></aside>;
}
