import { MailCheck, ShieldCheck, Sparkles } from "lucide-react";
import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen bg-slate-950 p-4 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-[28px] bg-white shadow-2xl lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.05fr_.95fr]">
        <section className="hidden bg-[radial-gradient(circle_at_top_left,_#1e3a8a,_#07111f_58%)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3 text-sm font-semibold tracking-wide"><div className="grid size-10 place-items-center rounded-xl bg-white/10"><MailCheck className="size-5" /></div>CampaignOS</div>
          <div className="max-w-xl"><p className="mb-4 text-sm font-semibold uppercase tracking-[.2em] text-blue-200">Customer engagement infrastructure</p><h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.04em]">Campaign operations, built for control.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">A secure workspace for audiences, approvals, provider integrations, delivery operations and engagement analytics.</p></div>
          <div className="grid grid-cols-2 gap-4 text-sm"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><ShieldCheck className="mb-3 size-5"/><b>Organization isolation</b><p className="mt-1 text-slate-400">RLS and server-side controls.</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Sparkles className="mb-3 size-5"/><b>Provider independent</b><p className="mt-1 text-slate-400">Brevo, Resend and Mailjet ready.</p></div></div>
        </section>
        <section className="flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md"><div className="mb-10 lg:hidden"><span className="font-bold">CampaignOS</span></div><p className="eyebrow">Secure workspace</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Welcome back</h2><p className="mt-2 text-sm leading-6 text-slate-500">Sign in with the staff account created for your organization.</p>
            {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <form action={login} className="mt-8 space-y-5"><label className="block"><span className="mb-2 block text-sm font-medium">Work email</span><input className="field" name="email" type="email" autoComplete="email" required placeholder="you@company.com"/></label><label className="block"><span className="mb-2 block text-sm font-medium">Password</span><input className="field" name="password" type="password" autoComplete="current-password" required placeholder="••••••••"/></label><button className="btn-primary w-full" type="submit">Sign in</button></form>
            <p className="mt-6 text-xs leading-5 text-slate-500">Admin registration is intentionally disabled. First administrators are bootstrapped securely from Supabase.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
