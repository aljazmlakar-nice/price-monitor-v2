import { scrapeUrl, scrapeHornbachDirect, getShopName, isOlibetta } from '../../lib/scrapers';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { urls } = req.body;
  if (!urls || !Object.keys(urls).length) return res.status(400).json({ error: 'Ni URL-jev' });

  const results = await Promise.allSettled(
    Object.entries(urls).map(async ([key, url]) => {
      if (!url || url.trim() === '') return { key, skipped: true };
      const cleanUrl = url.trim();
      
      // Use Hornbach direct API for Hornbach URLs
      const isHornbach = cleanUrl.includes('hornbach.');
      const data = isHornbach 
        ? await scrapeHornbachDirect(cleanUrl)
        : await scrapeUrl(cleanUrl);
        
      return {
        key,
        url: cleanUrl,
        name: getShopName(cleanUrl),
        isOlibetta: isOlibetta(cleanUrl),
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
      return a.price_num - b.price_num;
    });

  return res.status(200).json({ shops });
}

export const config = { api: { responseLimit: false } };
