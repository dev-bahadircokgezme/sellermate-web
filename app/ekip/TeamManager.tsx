"use client";

import { useEffect, useState } from "react";

type User={id:string,email:string,name:string,role:string,active:boolean,created_at:string,last_login_at:string|null};
const roleNames:Record<string,string>={ADMIN:"Yönetici",OPERATIONS:"Operasyon",FINANCE:"Finans",VIEWER:"Görüntüleyici"};

export default function TeamManager(){
 const [users,setUsers]=useState<User[]>([]);
 const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [role,setRole]=useState("OPERATIONS"); const [password,setPassword]=useState("");
 const [message,setMessage]=useState(""); const [loading,setLoading]=useState(false); const [resetId,setResetId]=useState<string|null>(null); const [newPassword,setNewPassword]=useState("");
 async function load(){const r=await fetch("/api/team/list",{cache:"no-store"});const d=await r.json();if(d.ok)setUsers(d.users||[])}
 useEffect(()=>{load()},[]);
 async function create(e:React.FormEvent){e.preventDefault();setLoading(true);setMessage("");try{const r=await fetch("/api/team/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,role,password})});const d=await r.json();setMessage(d.message||"");if(d.ok){setName("");setEmail("");setPassword("");await load()}}finally{setLoading(false)}}
 async function update(id:string,action:string,password?:string){setMessage("");const r=await fetch("/api/team/update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action,password})});const d=await r.json();setMessage(d.message||"");if(d.ok){setResetId(null);setNewPassword("");await load()}}
 return <>
  <section className="card ordersCard">
   <div className="cardHeader"><div><h2>Yeni Ekip Üyesi</h2><p className="muted">Kullanıcıyı oluştur, rolünü belirle ve geçici şifre ver. Kullanıcı bu bilgilerle giriş yapabilir.</p></div></div>
   <form onSubmit={create} style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,marginTop:18}}>
    <input required value={name} onChange={e=>setName(e.target.value)} placeholder="Ad Soyad" style={{padding:12,border:"1px solid #e5e7eb",borderRadius:10}} />
    <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-posta" style={{padding:12,border:"1px solid #e5e7eb",borderRadius:10}} />
    <select value={role} onChange={e=>setRole(e.target.value)} style={{padding:12,border:"1px solid #e5e7eb",borderRadius:10}}><option value="ADMIN">Yönetici</option><option value="OPERATIONS">Operasyon</option><option value="FINANCE">Finans</option><option value="VIEWER">Görüntüleyici</option></select>
    <input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Geçici şifre (en az 8 karakter)" style={{padding:12,border:"1px solid #e5e7eb",borderRadius:10}} />
    <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:12}}><button disabled={loading} className="primaryButton" type="submit">{loading?"Oluşturuluyor...":"Ekip Üyesi Oluştur"}</button>{message&&<span className="muted">{message}</span>}</div>
   </form>
  </section>
  <section className="card ordersCard"><div className="cardHeader"><div><h2>Ekip Kullanıcıları</h2><p className="muted">Kullanıcıları pasife alabilir veya geçici şifrelerini yenileyebilirsin.</p></div><span className="pill">{users.length} kullanıcı</span></div><div className="tableWrap"><table><thead><tr><th>Ad</th><th>E-posta</th><th>Rol</th><th>Son Giriş</th><th>Durum</th><th>İşlemler</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{roleNames[u.role]||u.role}</td><td>{u.last_login_at?new Date(u.last_login_at).toLocaleString("tr-TR"):"Henüz giriş yapmadı"}</td><td>{u.active?"Aktif":"Pasif"}</td><td><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" onClick={()=>update(u.id,"toggle-active")} style={{padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:8,background:"white",cursor:"pointer"}}>{u.active?"Pasife Al":"Aktifleştir"}</button><button type="button" onClick={()=>{setResetId(resetId===u.id?null:u.id);setNewPassword("")}} style={{padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:8,background:"white",cursor:"pointer"}}>Şifre Yenile</button></div>{resetId===u.id&&<div style={{display:"flex",gap:8,marginTop:8}}><input type="password" minLength={8} value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Yeni geçici şifre" style={{padding:8,border:"1px solid #e5e7eb",borderRadius:8}}/><button type="button" disabled={newPassword.length<8} onClick={()=>update(u.id,"reset-password",newPassword)} className="primaryButton" style={{padding:"8px 10px"}}>Kaydet</button></div>}</td></tr>)}</tbody></table></div>{message&&<p className="muted" style={{marginTop:12}}>{message}</p>}</section>
 </>
}
