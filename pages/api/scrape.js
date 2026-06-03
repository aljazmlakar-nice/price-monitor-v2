import { scrapeUrl, scrapeHornbachDirect, getShopName, isOlibetta } from '../../lib/scrapers';

async function getAllShippingCosts(shops, productName, apiKey) {
  if (!apiKey || !shops.length) return {};
  const shopList = shops.filter(s => !s.isOlibetta && s.price_num).map(s => s.name).join(', ');
  if (!shopList) return {};
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: `Poišči cene dostave za velik artikel (akvarij ~60kg) pri: ${shopList}. Produkt: "${productName}". Vrni SAMO JSON brez markdown: {"Hornbach.at": 49.99, "Zooroyal.at": 0}. Vrednost 0 = brezplačno. SAMO JSON.` }]
      })
    });
    if (!resp.ok) return {};
    const data = await resp.json();
    const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return {};
  } catch { return {}; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { urls, productName, apiKey } = req.body;
  if (!urls || !Object.keys(urls).length) return res.status(400).json({ error: 'Ni URL-jev' });

  const scrapeResults = await Promise.allSettled(
    Object.entries(urls).map(async ([key, url]) => {
      if (!url || url.trim() === '') return { key, skipped: true };
      const cleanUrl = url.trim();
      const data = cleanUrl.includes('hornbach.') ? await scrapeHornbachDirect(cleanUrl) : await scrapeUrl(cleanUrl);
      return { key, url: cleanUrl, name: getShopName(cleanUrl), isOlibetta: isOlibetta(cleanUrl), ...data };
    })
  );

  const shops = scrapeResults.filter(r => r.status === 'fulfilled' && !r.value.skipped).map(r => r.value);
  const shippingCosts = await getAllShippingCosts(shops, productName || '', apiKey);

  const shopsWithShipping = shops.map(shop => {
    const shippingNum = shippingCosts[shop.name] ?? null;
    return {
      ...shop,
      shipping_num: shippingNum,
      shipping: shippingNum === null ? null : shippingNum === 0 ? 'Brezplačno' : shippingNum.toLocaleString('de-AT', { minimumFractionDigits: 2 }) + ' €',
      total_num: shop.price_num !== null && shippingNum !== null ? shop.price_num + shippingNum : null,
    };
  }).sort((a, b) => {
    if (a.isOlibetta) return -1;
    if (b.isOlibetta) return 1;
    if (!a.price_num) return 1;
    if (!b.price_num) return -1;
    return (a.total_num ?? a.price_num) - (b.total_num ?? b.price_num);
  });

  return res.status(200).json({ shops: shopsWithShipping });
}

export const config = { api: { responseLimit: false } };
