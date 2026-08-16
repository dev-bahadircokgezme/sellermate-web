import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sellerId=process.env.TRENDYOL_SELLER_ID, apiKey=process.env.TRENDYOL_API_KEY, apiSecret=process.env.TRENDYOL_API_SECRET;
    if(!sellerId||!apiKey||!apiSecret) throw new Error("Trendyol credentials are not configured");
    const auth=Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const endDate=Date.now(), startDate=endDate-15*24*60*60*1000;
    const url=`https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/otherfinancials?startDate=${startDate}&endDate=${endDate}&transactionType=DeductionInvoices&page=0&size=1000`;
    const res=await fetch(url,{headers:{Authorization:`Basic ${auth}`,"User-Agent":`${sellerId} - SelfIntegration`,Accept:"application/json",storeFrontCode:"TR"},cache:"no-store"});
    const raw=await res.text();
    if(!res.ok) throw new Error(`Trendyol Other Financials API error: ${res.status} ${raw.slice(0,300)}`);
    const data=raw?JSON.parse(raw):{};
    const records=Array.isArray(data?.content)?data.content:[];
    const cargo=records.filter((r:any)=>{
      const value=String(r.transactionType??r.description??r.invoiceType??r.type??"").toLocaleLowerCase("tr-TR");
      return value.includes("kargo fatura") || value.includes("kargo faturası");
    });
    return NextResponse.json({ok:true,totalDeductionInvoices:records.length,cargoInvoices:cargo.length,samples:cargo.slice(0,5).map((r:any)=>({id:r.id,transactionType:r.transactionType,description:r.description,invoiceType:r.invoiceType,type:r.type,amount:r.amount,transactionDate:r.transactionDate}))});
  } catch(error){return NextResponse.json({ok:false,message:error instanceof Error?error.message:"Cargo invoice discovery failed"},{status:500});}
}
