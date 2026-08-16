import { NextResponse } from "next/server";
import { ensureAuthTables } from "../../../../src/lib/auth";

export async function GET(){
  try{
    const sql=await ensureAuthTables();
    const users=await sql`SELECT id,email,name,role,active,created_at,last_login_at FROM app_users ORDER BY created_at ASC`;
    return NextResponse.json({ok:true,users});
  }catch(error){return NextResponse.json({ok:false,message:error instanceof Error?error.message:"Team list failed"},{status:500});}
}
