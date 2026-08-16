"use client";

import { useState } from "react";

export default function PasswordForm(){
 const [currentPassword,setCurrentPassword]=useState("");
 const [newPassword,setNewPassword]=useState("");
 const [confirm,setConfirm]=useState("");
 const [message,setMessage]=useState("");
 const [loading,setLoading]=useState(false);
 async function submit(e:React.FormEvent){
  e.preventDefault(); setMessage("");
  if(newPassword!==confirm){setMessage("Yeni şifreler eşleşmiyor");return;}
  setLoading(true);
  try{
   const r=await fetch("/api/auth/change-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currentPassword,newPassword})});
   const d=await r.json(); setMessage(d.message||"");
   if(d.ok){setCurrentPassword("");setNewPassword("");setConfirm("");}
  }finally{setLoading(false)}
 }
 return <section className="card ordersCard"><div className="cardHeader"><div><h2>Şifre Değiştir</h2><p className="muted">Kendi SellerMate giriş şifreni buradan değiştirebilirsin.</p></div></div><form onSubmit={submit} style={{display:"grid",gap:12,maxWidth:520,marginTop:18}}><input required type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} placeholder="Mevcut şifre" style={{padding:12,border:"1px solid #e5e7eb",borderRadius:10}}/><input required minLength={8} type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Yeni şifre (en az 8 karakter)" style={{padding:12,border:"1px solid #e5e7eb",borderRadius:10}}/><input required minLength={8} type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Yeni şifre tekrar" style={{padding:12,border:"1px solid #e5e7eb",borderRadius:10}}/><div style={{display:"flex",gap:12,alignItems:"center"}}><button className="primaryButton" disabled={loading} type="submit">{loading?"Kaydediliyor...":"Şifreyi Değiştir"}</button>{message&&<span className="muted">{message}</span>}</div></form></section>
}
