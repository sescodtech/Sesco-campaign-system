"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { contactFields } from "@/lib/contacts/fields";

type SheetRow = Record<string, unknown>;
type Mapping = Record<string, string>;

type Result = {
  importId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  newRows: number;
  updatedRows: number;
};

export function ImportWizard() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [allRows, setAllRows] = useState<unknown[][]>([]);
  const [headerRow, setHeaderRow] = useState(1);
  const [startRow, setStartRow] = useState(2);
  const [endRow, setEndRow] = useState<number | "">("");
  const [mapping, setMapping] = useState<Mapping>({});
  const [strategy, setStrategy] = useState("skip");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [profiles, setProfiles] = useState<Array<{id:string;name:string;mapping:Mapping;header_row:number}>>([]);

  const headers = useMemo(() => {
    const row = allRows[Math.max(0, headerRow - 1)] || [];
    return row.map((v, i) => String(v ?? "").trim() || `Column ${i + 1}`);
  }, [allRows, headerRow]);

  useEffect(() => {
    fetch("/api/imports/mappings").then(r=>r.ok?r.json():[]).then(data=>setProfiles(Array.isArray(data)?data:[])).catch(()=>undefined);
  }, []);

  async function saveMapping() {
    const name = window.prompt("Name this mapping profile (for example: Core Banking Customer Export)");
    if (!name?.trim()) return;
    const res = await fetch("/api/imports/mappings", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({name:name.trim(), mapping, headerRow}) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Unable to save mapping"); return; }
    setProfiles(p=>[data,...p.filter(x=>x.id!==data.id)]);
  }

  function applyProfile(id:string) {
    const profile = profiles.find(p=>p.id===id);
    if (!profile) return;
    setHeaderRow(profile.header_row || 1);
    setMapping(profile.mapping || {});
  }

  const previewRows = useMemo(() => {
    if (!headers.length) return [];
    const from = Math.max(startRow - 1, headerRow);
    const to = endRow ? Math.min(Number(endRow), allRows.length) : allRows.length;
    return allRows.slice(from, to).slice(0, 20).map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])));
  }, [allRows, headers, startRow, endRow, headerRow]);

  function autoMap(nextHeaders: string[]) {
    const synonyms: Record<string, string[]> = {
      full_name: ["name", "customer name", "full name", "cust_name", "customer_name"],
      first_name: ["first name", "firstname", "first_name"],
      last_name: ["last name", "lastname", "last_name", "surname"],
      email: ["email", "email address", "email_id", "email_address"],
      phone: ["phone", "phone no", "phone number", "mobile", "mobile no", "phone_no"],
      whatsapp_phone: ["whatsapp", "whatsapp no", "whatsapp number", "whatsapp_phone"],
      account_number: ["account no", "account number", "acct no", "acct_no", "account_number"],
      external_customer_id: ["customer id", "cust id", "customer_id", "cif"],
      branch: ["branch", "branch name", "branch_code", "br_code"],
      customer_type: ["customer type", "customer_type", "segment"],
      customer_status: ["status", "customer status", "customer_status"],
      account_type: ["account type", "account_type"],
      relationship_manager: ["relationship manager", "rm", "account officer"],
    };
    const next: Mapping = {};
    for (const header of nextHeaders) {
      const normalized = header.toLowerCase().trim();
      for (const [field, aliases] of Object.entries(synonyms)) {
        if (aliases.includes(normalized)) { next[header] = field; break; }
      }
    }
    setMapping(next);
  }

  async function loadFile(nextFile: File) {
    setError(""); setResult(null); setFile(nextFile);
    const buffer = await nextFile.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });
    setWorkbook(wb);
    setSheetNames(wb.SheetNames);
    const first = wb.SheetNames[0];
    setSelectedSheet(first);
    loadSheet(wb, first);
  }

  function loadSheet(wb: XLSX.WorkBook, name: string) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "", raw: false });
    setAllRows(rows);
    setHeaderRow(1); setStartRow(2); setEndRow("");
    const nextHeaders = (rows[0] || []).map((v, i) => String(v ?? "").trim() || `Column ${i + 1}`);
    autoMap(nextHeaders);
  }

  function changeSheet(name: string) {
    setSelectedSheet(name);
    if (workbook) loadSheet(workbook, name);
  }

  async function submitImport() {
    if (!file || !headers.length) return;
    setBusy(true); setError("");
    try {
      const from = Math.max(startRow - 1, headerRow);
      const to = endRow ? Math.min(Number(endRow), allRows.length) : allRows.length;
      const rows: SheetRow[] = allRows.slice(from, to).map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])));
      const response = await fetch("/api/imports/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, fileSize: file.size, worksheetName: selectedSheet, headerRow, startRow, endRow: endRow || null, mapping, duplicateStrategy: strategy, rows }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed");
      setResult(data);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed"); }
    finally { setBusy(false); }
  }

  if (result) return <div className="panel p-8"><div className="mx-auto max-w-3xl text-center"><CheckCircle2 className="mx-auto size-12 text-emerald-600"/><h2 className="mt-4 text-2xl font-bold">Import completed</h2><p className="mt-2 text-sm text-slate-500">Your contact database has been processed and the import is stored in history.</p><div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{[["Rows",result.totalRows],["Valid",result.validRows],["Invalid",result.invalidRows],["Duplicates",result.duplicateRows],["New",result.newRows],["Updated",result.updatedRows]].map(([l,v])=><div key={String(l)} className="rounded-xl border border-slate-200 p-4"><div className="text-2xl font-bold">{v}</div><div className="mt-1 text-xs text-slate-500">{l}</div></div>)}</div><div className="mt-8 flex justify-center gap-2"><button className="btn-secondary" onClick={()=>{setResult(null);setFile(null);setAllRows([])}}>New import</button><button className="btn-primary" onClick={()=>router.push("/contacts")}>View contacts</button></div></div></div>;

  return <div className="space-y-6">
    {!file ? <label className="panel block cursor-pointer border-dashed p-10 text-center transition hover:border-slate-400"><input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(e)=>{const f=e.target.files?.[0];if(f) void loadFile(f)}}/><UploadCloud className="mx-auto size-10 text-slate-400"/><h2 className="mt-4 font-bold">Upload Excel or CSV</h2><p className="mt-2 text-sm text-slate-500">Supported formats: .xlsx, .xls, .csv. Preview and map columns before anything is imported.</p><span className="btn-primary mt-5">Choose file</span></label> : <>
      <div className="panel p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><FileSpreadsheet className="size-5"/></div><div><div className="font-semibold">{file.name}</div><div className="text-xs text-slate-500">{(file.size/1024).toFixed(1)} KB · {allRows.length} detected rows</div></div></div><button className="btn-secondary" onClick={()=>{setFile(null);setAllRows([])}}>Replace file</button></div></div>
      <div className="panel p-5"><h3 className="font-bold">1. Select data range</h3><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-medium">Worksheet<select className="field mt-2" value={selectedSheet} onChange={(e)=>changeSheet(e.target.value)}>{sheetNames.map(s=><option key={s}>{s}</option>)}</select></label><label className="text-sm font-medium">Header row<input className="field mt-2" type="number" min={1} value={headerRow} onChange={(e)=>{const n=Number(e.target.value)||1;setHeaderRow(n);setStartRow(Math.max(startRow,n+1));setTimeout(()=>autoMap((allRows[n-1]||[]).map((v,i)=>String(v??"").trim()||`Column ${i+1}`)),0)}}/></label><label className="text-sm font-medium">Start row<input className="field mt-2" type="number" min={headerRow+1} value={startRow} onChange={(e)=>setStartRow(Number(e.target.value)||headerRow+1)}/></label><label className="text-sm font-medium">End row <span className="font-normal text-slate-400">(optional)</span><input className="field mt-2" type="number" min={startRow} value={endRow} onChange={(e)=>setEndRow(e.target.value ? Number(e.target.value) : "")}/></label></div></div>
      <div className="panel overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold">2. Map columns</h3><p className="mt-1 text-sm text-slate-500">Match spreadsheet columns to contact fields. Unmapped columns will be ignored.</p></div><div className="flex gap-2"><select className="field max-w-56" defaultValue="" onChange={e=>{if(e.target.value)applyProfile(e.target.value)}}><option value="">Use saved mapping…</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button type="button" className="btn-secondary shrink-0" onClick={()=>void saveMapping()}>Save mapping</button></div></div><div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">{headers.map(h=><label key={h} className="rounded-xl border border-slate-200 p-3 text-sm"><span className="block truncate font-semibold">{h}</span><select className="field mt-2" value={mapping[h]||""} onChange={(e)=>setMapping(m=>({...m,[h]:e.target.value}))}><option value="">Ignore column</option>{contactFields.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>)}</div></div>
      <div className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-slate-200 p-5"><div><h3 className="font-bold">3. Preview</h3><p className="mt-1 text-sm text-slate-500">First {Math.min(20,previewRows.length)} rows from the selected range.</p></div></div><div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50"><tr>{headers.map(h=><th key={h} className="whitespace-nowrap px-3 py-2 font-semibold text-slate-500">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{previewRows.map((row,i)=><tr key={i}>{headers.map(h=><td key={h} className="max-w-[220px] truncate px-3 py-2.5 text-slate-700">{String(row[h]??"")}</td>)}</tr>)}</tbody></table></div></div>
      <div className="panel p-5"><h3 className="font-bold">4. Duplicate handling</h3><div className="mt-4 grid gap-3 sm:grid-cols-3">{[["skip","Skip duplicates","Keep existing contacts unchanged."],["update","Update existing","Update existing contacts when a match is found."],["create_new_only","Create new only","Only insert contacts not already in the database."]].map(([v,t,d])=><label key={v} className={`cursor-pointer rounded-xl border p-4 ${strategy===v?"border-slate-950 ring-1 ring-slate-950":"border-slate-200"}`}><input className="mr-2" type="radio" name="strategy" value={v} checked={strategy===v} onChange={()=>setStrategy(v)}/><span className="font-semibold">{t}</span><span className="mt-1 block text-xs text-slate-500">{d}</span></label>)}</div></div>
      {error && <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="size-5 shrink-0"/>{error}</div>}
      <div className="flex justify-end"><button className="btn-primary min-w-44" disabled={busy || !Object.values(mapping).some(Boolean)} onClick={()=>void submitImport()}>{busy?<Loader2 className="size-4 animate-spin"/>:null}{busy?"Importing…":"Validate & Import"}</button></div>
    </>}
  </div>;
}
