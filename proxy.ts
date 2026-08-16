import { NextRequest, NextResponse } from "next/server";

const COOKIE = "sellermate_session";

function decodeBase64Url(value:string){
  const base64=value.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length/4)*4,"=");
  return atob(base64);
}

function hex(bytes:ArrayBuffer){return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("")}

async function valid(token:string|undefined, secret:string){
  if(!token) return false;
  try{
    const [encoded,signature]=token.split(".");
    if(!encoded||!signature) return false;
    const payload=decodeBase64Url(encoded);
    const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const signed=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload));
    if(hex(signed)!==signature) return false;
    const [,expiresRaw]=payload.split("|");
    return Number(expiresRaw)>Math.floor(Date.now()/1000);
  }catch{return false;}
}

export async function proxy(req:NextRequest){
  const {pathname}=req.nextUrl;
  if(pathname.startsWith("/_next")||pathname==="/favicon.ico"||pathname.startsWith("/api/auth")||pathname==="/giris") return NextResponse.next();

  const secret=process.env.AUTH_SECRET;
  const adminEmail=process.env.SELLERMATE_ADMIN_EMAIL;
  const adminPassword=process.env.SELLERMATE_ADMIN_PASSWORD;
  if(!secret||!adminEmail||!adminPassword) return NextResponse.next();

  const ok=await valid(req.cookies.get(COOKIE)?.value,secret);
  if(ok) return NextResponse.next();
  if(pathname.startsWith("/api/")) return NextResponse.json({ok:false,message:"Oturum gerekli"},{status:401});
  return NextResponse.redirect(new URL("/giris",req.url));
}

export const config={matcher:["/((?!_next/static|_next/image).*)"]};
