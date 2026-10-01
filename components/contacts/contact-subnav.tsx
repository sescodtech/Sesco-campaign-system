"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  ["All Contacts", "/contacts"],
  ["Imports", "/contacts/imports"],
  ["Lists & Tags", "/contacts/lists"],
  ["Segments", "/contacts/segments"],
  ["Fields & Mappings", "/contacts/settings"],
  ["Suppression", "/contacts/suppression"],
] as const;

export function ContactSubnav() {
  const pathname = usePathname();
  return <div className="mb-6 overflow-x-auto border-b border-slate-200"><div className="flex min-w-max gap-6">
    {tabs.map(([label, href]) => {
      const active = href === "/contacts" ? pathname === href : pathname.startsWith(href);
      return <Link key={href} href={href} className={`border-b-2 pb-3 text-sm font-semibold ${active ? "border-slate-950 text-slate-950" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{label}</Link>;
    })}
  </div></div>;
}
