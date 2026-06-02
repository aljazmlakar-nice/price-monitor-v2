import * as cheerio from 'cheerio';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'de-AT,de;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
};

async function fetchPage(url) {
  const resp = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return await resp.text();
}

function parsePrice(text) {
  if (!text) return null;
  const clean = text.replace(/[^\d,\.]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) || num < 1 ? null : num;
}

function formatPrice(num, currency = '€') {
  if (!num) return null;
  return num.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
}

// Universal scraper - tries all known methods
async function universalScrape(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  // Method 1: JSON-LD structured data
  const jsonLds = $('script[type="application/ld+json"]').toArray()
    .map(el => { try { return JSON.parse($(el).html()); } catch { return null; } })
    .filter(Boolean);

  for (const jsonLd of jsonLds) {
    const offers = jsonLd.offers || (jsonLd['@graph'] || []).find(g => g.offers)?.offers;
    if (offers?.price) {
      const num = parseFloat(offers.price);
      if (num > 1) return {
        price_num: num,
        price: formatPrice(num),
        currency: '€',
        available: offers.availability?.includes('InStock') ?? null
      };
    }
  }

  // Method 2: Open Graph / meta product price
  const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
                    $('meta[name="price"]').attr('content') ||
                    $('meta[property="og:price:amount"]').attr('content');
  if (metaPrice) {
    const num = parseFloat(metaPrice);
    if (num > 1) return { price_num: num, price: formatPrice(num), currency: '€', available: null };
  }

  // Method 3: Common CSS selectors
  const selectors = [
    '[data-testid="price"]', '[data-price]', '.product-price__value',
    '.price--current', '.price--default', '.product-detail-price',
    '.price__regular', '.price-box .price', '.product-info-price .price',
    '#product-price', '.price', '[class*="currentPrice"]', '[class*="finalPrice"]',
    '[itemprop="price"]'
  ];
  for (const sel of selectors) {
    const el = $(sel).first();
    const text = el.attr('content') || el.text().trim();
    const num = parsePrice(text);
    if (num && num > 1) return { price_num: num, price: formatPrice(num), currency: '€', available: null };
  }

  // Method 4: Regex in raw HTML for price patterns
  const pricePatterns = [
    /"price":\s*"?([\d]+\.[\d]{2})"?/,
    /"price":\s*([\d]+\.[\d]{2})/,
    /itemprop="price"[^>]*content="([\d]+\.[\d]{2})"/,
    /["']price["']\s*:\s*["']([\d,\.]+)["']/,
  ];
  for (const pattern of pricePatterns) {
    const match = html.match(pattern);
    if (match) {
      const num = parseFloat(match[1].replace(',', '.'));
      if (num > 1) return { price_num: num, price: formatPrice(num), currency: '€', available: null };
    }
  }

  throw new Error('Cena ni najdena (JS stran)');
}

export async function scrapeUrl(url) {
  try {
    return await universalScrape(url);
  } catch (err) {
    return { price_num: null, price: null, currency: '€', available: null, error: err.message };
  }
}

export function getShopName(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const parts = domain.split('.');
    const name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    return name + '.' + parts[parts.length - 1];
  } catch {
    return url;
  }
}

export function isOlibetta(url) {
  try { return new URL(url).hostname.includes('olibetta'); } catch { return false; }
}
