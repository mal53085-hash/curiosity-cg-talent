"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { fieldControlClass } from "@/components/ui/field";

export function StyleProfileSave({ searchId, defaultName, existingProfile }: { searchId: string; defaultName: string; existingProfile?: { id: string; name: string; status: "active" | "archived" } | null }) {
  const [open, setOpen] = useState(false); const [name, setName] = useState(defaultName); const [description, setDescription] = useState(""); const [loading, setLoading] = useState(false); const [saved, setSaved] = useState(existingProfile ?? null); const [error, setError] = useState("");
  async function save() {
    setLoading(true); setError("");
    try { const response = await fetch("/api/style-profiles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ search_id: searchId, name, description }), cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setSaved({ id: body.id, name: body.name, status: "active" }); setOpen(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Style Profileを保存できませんでした。"); }
    finally { setLoading(false); }
  }
  async function updateProfile(change: { name?: string; status?: "active" | "archived" }) {
    if (!saved) return; setLoading(true); setError("");
    try { const response = await fetch(`/api/style-profiles/${saved.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(change), cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setSaved({ ...saved, ...change }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Style Profileを更新できませんでした。"); }
    finally { setLoading(false); }
  }
  if (saved) return <div><div className="flex flex-wrap items-center gap-2 rounded-lg border bg-surface-muted px-3 py-2 text-xs"><Check size={13}/><span>Style Profile: {saved.name}</span><span className="rounded-full border px-2 py-0.5 text-[9px]">{saved.status}</span><button type="button" disabled={loading} onClick={() => { const next = window.prompt("Profile Name", saved.name); if (next?.trim()) void updateProfile({ name: next.trim() }); }} className="ml-auto text-[10px] text-muted hover:text-foreground">名前変更</button>{saved.status === "active" ? <button type="button" disabled={loading} onClick={() => { if (window.confirm("このStyle Profileをアーカイブしますか？")) void updateProfile({ status: "archived" }); }} className="text-[10px] text-muted hover:text-foreground">アーカイブ</button> : null}</div>{error ? <p role="alert" className="mt-2 text-xs text-danger">{error}</p> : null}</div>;
  return <div>{open ? <div className="w-full max-w-md rounded-xl border bg-surface p-4 shadow-[0_16px_45px_rgba(35,34,30,.08)]"><p className="text-xs font-medium">Style Profileとして保存</p><p className="mt-1 text-[10px] leading-4 text-muted">管理者が明示的に保存した場合だけ、再利用可能な基準になります。元画像は使用しません。</p><input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} className={`${fieldControlClass} mt-3`} aria-label="Profile Name"/><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} className={`${fieldControlClass} mt-2 min-h-20`} placeholder="Description（任意）"/><div className="mt-3 flex gap-2"><button type="button" onClick={save} disabled={loading || !name.trim()} className={buttonStyles("primary", "h-9 text-xs")}>{loading ? <Loader2 size={13} className="animate-spin"/> : <Sparkles size={13}/>}保存</button><button type="button" onClick={() => setOpen(false)} className={buttonStyles("ghost", "h-9 text-xs")}>キャンセル</button></div>{error ? <p role="alert" className="mt-2 text-xs text-danger">{error}</p> : null}</div> : <button type="button" onClick={() => setOpen(true)} className={buttonStyles("secondary", "h-9 text-xs")}><Sparkles size={13}/>Style Profileとして保存</button>}</div>;
}
