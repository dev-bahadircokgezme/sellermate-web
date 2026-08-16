import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { createHash } from "crypto";

export async function GET() {
  try {
    const sellerId=process.env.TRENDYOL_SELLER_ID, apiKey=process.env.TRENDYOL_API_KEY, apiSecret=process.env.TRENDYOL_API_SECRET, dbUrl=process.env.DATABASE_URL;
    if(!sellerId||!apiKey||!apiSecret||!dbUrl) throw new Error("Required environment variables are not configured");
    const auth=Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const headers={Authorization:`Basic ${auth}`,"User-Agent":`${sellerId} - SelfIntegration`,Accept:"application/json","storeFrontCode":"TR"};
    const endDate=Date.now(), startDate=endDate-15*24*60*60*1000;
    const otherUrl=`https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/otherfinancials?startDate=${startDate}&endDate=${endDate}&transactionType=DeductionInvoices&page=0&size=1000`;
    const otherRes=await fetch(otherUrl,{headers,cache:"no-store"});
    if(!otherRes.ok) throw new Error(`Trendyol Other Financials API error: ${otherRes.status}`);
    const otherData=await otherRes.json();
    const records=Array.isArray(otherData?.content)?otherData.content:[];
    const cargoInvoices=records.filter((r:any)=>String(r.transactionType??"").toLocaleLowerCase("tr-TR").includes("kargo fatura"));
    const sql=neon(dbUrl);
    await sql`ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS desi numeric(14,2) DEFAULT 0`;
    await sql`ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS invoice_id text`;
    let synced=0, matched=0; const invoiceResults:any[]=[];

    for(const inv of cargoInvoices){
      const invoiceId=String(inv.id??"");
      if(!invoiceId) continue;
      const detailUrl=`https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/cargo-invoice/${encodeURIComponent(invoiceId)}?page=0&size=1000`;
      const detailRes=await fetch(detailUrl,{headers,cache:"no-store"});
      if(!detailRes.ok){invoiceResults.push({invoiceId,status:detailRes.status,items:0});continue;}
      const detailData=await detailRes.json();
      const items=Array.isArray(detailData?.content)?detailData.content:Array.isArray(detailData)?detailData:[];
      invoiceResults.push({invoiceId,status:200,items:items.length});
      for(const item of items){
        const orderNumber=String(item.orderNumber??item.orderNo??"");
        const amount=Number(item.amount??0);
        const desi=Number(item.desi??0);
        let orderId:null|string=null;
        if(orderNumber){const found=await sql`SELECT id FROM orders WHERE marketplace_order_number=${orderNumber} LIMIT 1`;if(found.length){orderId=String(found[0].id);matched++;}}
        const id=`ty-cargo-${createHash("sha1").update(`${invoiceId}|${orderNumber}|${amount}|${desi}|${item.trackingNumber??""}`).digest("hex")}`;
        await sql`INSERT INTO financial_transactions(id,company_id,marketplace_account_id,order_id,type,amount,description,transaction_at,order_number,desi,invoice_id,raw_type)
          VALUES(${id},'default-company','trendyol-main',${orderId},'Cargo',${amount},${String(item.description??"Trendyol kargo faturası")},${new Date(Number(inv.transactionDate??Date.now())).toISOString()},${orderNumber},${desi},${invoiceId},'Cargo')
          ON CONFLICT(id) DO UPDATE SET order_id=EXCLUDED.order_id,amount=EXCLUDED.amount,order_number=EXCLUDED.order_number,desi=EXCLUDED.desi,invoice_id=EXCLUDED.invoice_id`;
        synced++;
      }
    }
    const [totals]=await sql`SELECT COALESCE(SUM(amount),0)::float AS cargo_total, COUNT(*)::int AS cargo_records FROM financial_transactions WHERE type='Cargo'`;
    return NextResponse.json({ok:true,cargoInvoices:cargoInvoices.length,synced,matched,totals,invoiceResults,message:"Trendyol kargo detayları SellerMate veritabanına aktarıldı"});
  } catch(error){return NextResponse.json({ok:false,message:error instanceof Error?error.message:"Cargo sync failed"},{status:500});}
}
