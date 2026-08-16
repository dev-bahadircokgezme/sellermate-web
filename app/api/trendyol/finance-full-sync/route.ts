import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { createHash } from "crypto";

const TYPES = ["Sale","Return","Discount","DiscountCancel","Coupon","CouponCancel","ProvisionPositive","ProvisionNegative","TyDiscount","TyDiscountCancel","TyCoupon","TyCouponCancel","SellerRevenuePositive","SellerRevenueNegative","CommissionPositive","CommissionNegative","SellerRevenuePositiveCancel","SellerRevenueNegativeCancel","CommissionPositiveCancel","CommissionNegativeCancel","DeliveryFee","DeliveryFeeCancel"];

export async function GET() {
 try {
  const sellerId=process.env.TRENDYOL_SELLER_ID, apiKey=process.env.TRENDYOL_API_KEY, apiSecret=process.env.TRENDYOL_API_SECRET, dbUrl=process.env.DATABASE_URL;
  if(!sellerId||!apiKey||!apiSecret||!dbUrl) throw new Error("Required environment variables are not configured");
  const sql=neon(dbUrl); const auth=Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const endDate=Date.now(), startDate=endDate-15*24*60*60*1000;
  let synced=0, matched=0; const counts:Record<string,number>={};
  for(const type of TYPES){
   const url=`https://apigw.trendyol.com/integration/finance/che/sellers/${sellerId}/settlements?startDate=${startDate}&endDate=${endDate}&transactionType=${type}&page=0&size=1000`;
   const res=await fetch(url,{headers:{Authorization:`Basic ${auth}`,"User-Agent":`${sellerId} - SelfIntegration`,Accept:"application/json"},cache:"no-store"});
   if(!res.ok){counts[type]=-res.status;continue;}
   const data=await res.json(); const records=Array.isArray(data?.content)?data.content:[]; counts[type]=records.length;
   for(const r of records){
    const orderNumber=String(r.orderNumber??r.orderNo??""); let orderId:null|string=null;
    if(orderNumber){const found=await sql`SELECT id FROM orders WHERE marketplace_order_number=${orderNumber} LIMIT 1`;if(found.length){orderId=String(found[0].id);matched++;}}
    const amount=Number(r.amount??r.paymentOrderIdAmount??r.salePrice??0);
    const commissionAmount=Number(r.commissionAmount??r.comissionAmount??0);
    const sellerRevenue=Number(r.sellerRevenue??0);
    const paymentOrderId=String(r.paymentOrderId??"");
    const barcode=String(r.barcode??"");
    const rawDate=Number(r.transactionDate??r.transactionDateTime??r.createdDate??Date.now());
    const id=`ty-fin-${createHash("sha1").update(`${type}|${orderNumber}|${r.id??r.transactionId??""}|${rawDate}|${amount}|${barcode}`).digest("hex")}`;
    await sql`INSERT INTO financial_transactions(id,company_id,marketplace_account_id,order_id,type,amount,description,transaction_at,commission_amount,seller_revenue,payment_order_id,order_number,barcode,raw_type)
      VALUES(${id},'default-company','trendyol-main',${orderId},${type},${amount},${String(r.description??barcode??type)},${new Date(rawDate).toISOString()},${commissionAmount},${sellerRevenue},${paymentOrderId},${orderNumber},${barcode},${type})
      ON CONFLICT(id) DO UPDATE SET order_id=EXCLUDED.order_id,amount=EXCLUDED.amount,description=EXCLUDED.description,transaction_at=EXCLUDED.transaction_at,commission_amount=EXCLUDED.commission_amount,seller_revenue=EXCLUDED.seller_revenue,payment_order_id=EXCLUDED.payment_order_id,order_number=EXCLUDED.order_number,barcode=EXCLUDED.barcode,raw_type=EXCLUDED.raw_type`;
    synced++;
   }
  }
  const [totals] = await sql`SELECT COALESCE(SUM(commission_amount),0)::float AS commission, COALESCE(SUM(seller_revenue),0)::float AS seller_revenue FROM financial_transactions WHERE transaction_at >= to_timestamp(${startDate}/1000.0)`;
  return NextResponse.json({ok:true,synced,matched,counts,totals,message:"Trendyol finans hareketleri komisyon ve hakediş alanlarıyla senkronize edildi"});
 } catch(error){return NextResponse.json({ok:false,message:error instanceof Error?error.message:"Full finance sync failed"},{status:500});}
}
