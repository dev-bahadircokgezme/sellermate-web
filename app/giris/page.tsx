"use client";

import { FormEvent, useState } from "react";

export default function LoginPage(){
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 async function submit(e:FormEvent){
  e.preventDefault(); setError(""); setLoading(true);
  const res=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){setError(data.message||"Giriş başarısız");setLoading(false);return;}
  window.location.href="/";
 }
 return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24}}>
  <section className="card" style={{width:"100%",maxWidth:420,padding:28}}>
   <p className="eyebrow">SELLERMATE</p><h1 style={{fontSize:30}}>Giriş Yap</h1><p className="muted">SellerMate yönetim paneline güvenli erişim.</p>
   <form onSubmit={submit} style={{display:"grid",gap:14,marginTop:24}}>
    <label style={{display:"grid",gap:7,fontSize:13}}>E-posta<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required style={{padding:12,border:"1px solid #e5e7eb",borderRadius:10}}/></label>
    <label style={{display:"grid",gap:7,fontSize:13}}>Şifre<input value={password} onChange={e=>setPassword(e.target.value)} type="password" required style={{padding:12,border:"1px solid #e5e7eb",borderRadius:10}}/></label>
    {error?<p style={{margin:0,color:"#b91c1c",fontSize:13}}>{error}</p>:null}
    <button className="primaryButton" disabled={loading} type="submit">{loading?"Giriş yapılıyor...":"Giriş Yap"}</button>
   </form>
  </section>
 </main>
}
