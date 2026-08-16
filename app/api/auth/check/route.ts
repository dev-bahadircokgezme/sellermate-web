import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(){
  return NextResponse.json({
    ok:true,
    authConfigured:Boolean(process.env.AUTH_SECRET && process.env.SELLERMATE_ADMIN_EMAIL && process.env.SELLERMATE_ADMIN_PASSWORD),
    variables:{
      AUTH_SECRET:Boolean(process.env.AUTH_SECRET),
      SELLERMATE_ADMIN_EMAIL:Boolean(process.env.SELLERMATE_ADMIN_EMAIL),
      SELLERMATE_ADMIN_PASSWORD:Boolean(process.env.SELLERMATE_ADMIN_PASSWORD)
    }
  });
}
