import { NextRequest, NextResponse } from "next/server";

const COOKIE = "sellermate_session";
function decodeBase64Url(value:string){const base64=value.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length/4)*4,"=");return atob(base64)}
function hex(bytes:ArrayBuffer){return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("")}

async function session(token:string|undefined, secret:string){
  if(!token) return null;
  try{
    const [encoded,signature]=token.split("."); if(!encoded||!signature) return null;
    const payload=decodeBase64Url(encoded);
    const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const signed=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload));
    if(hex(signed)!==signature) return null;
    const [email,expiresRaw,roleRaw]=payload.split("|");
    if(Number(expiresRaw)<=Math.floor(Date.now()/1000)) return null;
    return {email,role:roleRaw||"ADMIN"};
  }catch{return null;}
}

function allowed(role:string, pathname:string){
  if(role==="ADMIN") return true;
  if(pathname.startsWith("/ekip")||pathname.startsWith("/ayarlar")||pathname.startsWith("/entegrasyonlar")||pathname.startsWith("/api/team")) return false;
  if(role==="OPERATIONS" && (pathname.startsWith("/finans")||pathname.startsWith("/karlilik")||pathname.startsWith("/raporlar"))) return false;
  if(role==="FINANCE" && (pathname.startsWith("/urunler")||pathname.startsWith("/api/products"))) return false;
  if(role==="VIEWER" && pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) return false;
  return true;
}

export async function proxy(req:NextRequest){
  const {pathname}=req.nextUrl;
  if(pathname.startsWith("/_next")||pathname==="/favicon.ico"||pathname.startsWith("/api/auth")||pathname==="/giris"||pathname==="/davet") return NextResponse.next();
  const secret=process.env.AUTH_SECRET;
  if(!secret) return NextResponse.next();
  const s=await session(req.cookies.get(COOKIE)?.value,secret);
  if(!s){if(pathname.startsWith("/api/")) return NextResponse.json({ok:false,message:"Oturum gerekli"},{status:401}); return NextResponse.redirect(new URL("/giris",req.url));}
  if(!allowed(s.role,pathname)){if(pathname.startsWith("/api/")) return NextResponse.json({ok:false,message:"Bu işlem için yetkiniz yok"},{status:403}); return NextResponse.redirect(new URL("/",req.url));}
  return NextResponse.next();
}

export const config={matcher:["/((?!_next/static|_next/image).*)"]};
