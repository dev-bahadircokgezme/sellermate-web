const TRENDYOL_BASE_URL = "https://apigw.trendyol.com/integration/order/sellers";

function credentials() {
  const sellerId = process.env.TRENDYOL_SELLER_ID;
  const apiKey = process.env.TRENDYOL_API_KEY;
  const apiSecret = process.env.TRENDYOL_API_SECRET;
  if (!sellerId || !apiKey || !apiSecret) throw new Error("Trendyol credentials are not configured");
  return { sellerId, apiKey, apiSecret };
}

export async function getTrendyolOrders(size = 50) {
  const { sellerId, apiKey, apiSecret } = credentials();
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const url = `${TRENDYOL_BASE_URL}/${sellerId}/v2/orders?size=${size}&orderByField=PackageLastModifiedDate&orderByDirection=DESC`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      "User-Agent": `${sellerId} - SelfIntegration`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Trendyol API error: ${response.status}`);
  return response.json();
}
