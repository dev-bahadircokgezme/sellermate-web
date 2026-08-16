import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sellerId=process.env.TRENDYOL_SELLER_ID, apiKey=process.env.TRENDYOL_API_KEY, apiSecret=process.env.TRENDYOL_API_SECRET;
    if(!sellerId||!apiKey||!apiSecret) throw new Error("Trendyol credentials are not configured");
    const auth=Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const endDate=Date.now(), startDate=endDate-30*24*60*60*1000;
    const url=`https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/settlements?startDate=${startDate}&endDate=${endDate}&transactionType=DeductionInvoices&page=0&size=1000`;
    const res=await fetch(url,{headers:{Authorization:`Basic ${auth}`,"User-Agent":`${sellerId} - SelfIntegration`,Accept:"application/json"},cache:"no-store"});
    if(!res.ok) throw new Error(`Trendyol Finance API error: ${res.status}`);
    const data=await res.json();
    const records=Array.isArray(data?.content)?data.content:[];
    const cargo=records.filter((r:any)=>String(r.transactionType??r.description??r.invoiceType??"").toLocaleLowerCase("tr-TR").includes("kargo"));
    return NextResponse.json({ok:true,totalDeductionInvoices:records.length,cargoInvoices:cargo.length,samples:cargo.slice(0,5).map((r:any)=>({id:r.id,transactionType:r.transactionType,description:r.description,invoiceType:r.invoiceType,amount:r.amount,transactionDate:r.transactionDate}))});
  } catch(error){return NextResponse.json({ok:false,message:error instanceof Error?error.message:"Cargo invoice discovery failed"},{status:500});}
}
