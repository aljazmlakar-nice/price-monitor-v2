import { scrapeUrl, scrapeHornbachDirect, getShopName, isOlibetta } from '../../lib/scrapers';

function fmt(num) {
  return num.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { urls } = req.body;
  if (!urls || !Object.keys(urls).length) return res.status(400).json({ error: 'Ni URL-jev' });

  const scrapeResults = await Promise.allSettled(
    Object.entries(urls).map(async ([key, url]) => {
      if (!url || url.trim() === '') return { key, skipped: true };
      const cleanUrl = url.trim();
      const data = cleanUrl.includes('hornbach.') ? await scrapeHornbachDirect(cleanUrl) : await scrapeUrl(cleanUrl);
      const shippingNum = data.shipping_num ?? null;
      const totalNum = data.price_num !== null && shippingNum !== null ? data.price_num + shippingNum : null;
      return {
        key, url: cleanUrl, name: getShopName(cleanUrl), isOlibetta: isOlibetta(cleanUrl),
        ...data,
        shipping_num: shippingNum,
        shipping: shippingNum === null ? null : shippingNum === 0 ? 'Brezplačno' : fmt(shippingNum),
        total_num: totalNum,
        total: totalNum !== null ? fmt(totalNum) : null,
      };
    })
  );

  const shops = scrapeResults
    .filter(r => r.status === 'fulfilled' && !r.value.skipped)
    .map(r => r.value)
    .sort((a, b) => {
      if (a.isOlibetta) return -1;
      if (b.isOlibetta) return 1;
      if (!a.price_num) return 1;
      if (!b.price_num) return -1;
      return (a.total_num ?? a.price_num) - (b.total_num ?? b.price_num);
    });

  return res.status(200).json({ shops });
}

export const config = { api: { responseLimit: false } };
