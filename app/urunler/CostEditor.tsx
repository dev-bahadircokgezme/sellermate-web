"use client";

import { useState } from "react";

export default function CostEditor({ id, initialCost }: { id: string; initialCost: number }) {
  const [cost, setCost] = useState(String(initialCost || ""));
  const [state, setState] = useState<"idle"|"saving"|"saved"|"error">("idle");

  async function save() {
    setState("saving");
    const response = await fetch("/api/products/cost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, cost: Number(cost.replace(",", ".")) }),
    });
    setState(response.ok ? "saved" : "error");
  }

  return <div style={{display:"flex",gap:8,alignItems:"center"}}>
    <input value={cost} onChange={e=>{setCost(e.target.value);setState("idle")}} inputMode="decimal" placeholder="0,00" style={{width:110,padding:"9px 10px",border:"1px solid #e5e7eb",borderRadius:8}} />
    <button onClick={save} disabled={state==="saving"} style={{padding:"9px 11px",border:0,borderRadius:8,cursor:"pointer"}}>{state==="saving"?"Kaydediliyor":state==="saved"?"Kaydedildi":"Kaydet"}</button>
    {state==="error" && <span style={{fontSize:11,color:"#b91c1c"}}>Hata</span>}
  </div>;
}
