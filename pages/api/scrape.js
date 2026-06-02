import { scrapeUrl, scrapeHornbachDirect, getShopName, isOlibetta } from '../../lib/scrapers';

async function getShippingCost(shopName, productName, apiKey) {
  if (!apiKey) return null;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 200,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Koliko stane dostava za "${productName}" pri ${shopName}? To je velik artikel (akvarij ~60kg). Poišči trenutno ceno dostave na njihovi spletni strani. Vrni SAMO številko v evrih (npr. 49.99) ali 0 če je brezplačna. Nič drugega.`
        }]
      })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
    const match = text.match(/[\d]+[,\.][\d]{0,2}/);
    if (match) return parseFloat(match[0].replace(',', '.'));
    return null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { urls, productName, apiKey } = req.body;
  if (!urls || !Object.keys(urls).length) return res.status(400).json({ error: 'Ni URL-jev' });

  const results = await Promise.allSettled(
    Object.entries(urls).map(async ([key, url]) => {
      if (!url || url.trim() === '') return { key, skipped: true };
      const cleanUrl = url.trim();
      const isHornbach = cleanUrl.includes('hornbach.');
      const data = isHornbach
        ? await scrapeHornbachDirect(cleanUrl)
        : await scrapeUrl(cleanUrl);

      const shopName = getShopName(cleanUrl);
      
      // Get shipping cost via AI
      let shipping = null;
      if (apiKey && data.price_num && !isOlibetta(cleanUrl)) {
        shipping = await getShippingCost(shopName, productName || 'akvarij', apiKey);
      }

      return {
        key,
        url: cleanUrl,
        name: shopName,
        isOlibetta: isOlibetta(cleanUrl),
        shipping_num: shipping,
        shipping: shipping !== null ? (shipping === 0 ? 'Brezplačno' : shipping.toLocaleString('de-AT', { minimumFractionDigits: 2 }) + ' €') : null,
        total_num: data.price_num && shipping !== null ? data.price_num + shipping : null,
        ...data
      };
    })
  );

  const shops = results
    .filter(r => r.status === 'fulfilled' && !r.value.skipped)
    .map(r => r.value)
    .sort((a, b) => {
      if (a.isOlibetta) return -1;
      if (b.isOlibetta) return 1;
      if (!a.price_num) return 1;
      if (!b.price_num) return -1;
      return (a.total_num || a.price_num) - (b.total_num || b.price_num);
    });

  return res.status(200).json({ shops });
}

export const config = { api: { responseLimit: false, bodyParser: { sizeLimit: '1mb' } } };
