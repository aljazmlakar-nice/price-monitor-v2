import { getShopName, isOlibetta } from '../../lib/scrapers';

function fmt(num) {
  return num.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { urls } = req.body;
  if (!urls || !Object.keys(urls).length) return res.status(400).json({ error: 'Ni URL-jev' });

  const scraperUrl = process.env.SCRAPER_URL;
  const scraperSecret = process.env.SCRAPER_SECRET;

  if (!scraperUrl) {
    return res.status(500).json({ error: 'SCRAPER_URL ni nastavljen v Vercel okolju.' });
  }

  const validUrls = Object.fromEntries(
    Object.entries(urls).filter(([_, v]) => v && v.trim())
  );

  try {
    // Call the Playwright scraper server (one request for all URLs)
    const resp = await fetch(`${scraperUrl}/scrape-many`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-scraper-key': scraperSecret || '',
      },
      body: JSON.stringify({ urls: validUrls }),
      // Render free tier can be slow to wake up
      signal: AbortSignal.timeout(120000),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: err.error || `Scraper napaka HTTP ${resp.status}` });
    }

    const { results } = await resp.json();

    const shops = Object.entries(results).map(([key, data]) => {
      const url = validUrls[key];
      const shippingNum = data.shipping_num ?? null;
      const totalNum = data.price_num != null && shippingNum != null ? data.price_num + shippingNum : null;
      return {
        key,
        url,
        name: getShopName(url),
        isOlibetta: isOlibetta(url),
        price_num: data.price_num ?? null,
        price: data.price_num != null ? fmt(data.price_num) : null,
        currency: '€',
        available: data.available ?? null,
        shipping_num: shippingNum,
        shipping: shippingNum == null ? null : shippingNum === 0 ? 'Brezplačno' : fmt(shippingNum),
        total_num: totalNum,
        total: totalNum != null ? fmt(totalNum) : null,
        error: data.error || null,
      };
    }).sort((a, b) => {
      if (a.isOlibetta) return -1;
      if (b.isOlibetta) return 1;
      if (!a.price_num) return 1;
      if (!b.price_num) return -1;
      return (a.total_num ?? a.price_num) - (b.total_num ?? b.price_num);
    });

    return res.status(200).json({ shops });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Scraper se prebuja (Render free tier). Poskusi znova čez 30 sekund.' });
    }
    return res.status(500).json({ error: err.message });
  }
}

export const config = { api: { responseLimit: false } };
