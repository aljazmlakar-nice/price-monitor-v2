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


// Extract shipping cost from HTML/structured data
function extractShipping($, html) {
  // Method 1: JSON-LD shippingDetails
  const jsonLds = $('script[type="application/ld+json"]').toArray()
    .map(el => { try { return JSON.parse($(el).html()); } catch { return null; } })
    .filter(Boolean);
  for (const jsonLd of jsonLds) {
    const offers = jsonLd.offers || (jsonLd['@graph'] || []).find(g => g.offers)?.offers;
    const shipping = offers?.shippingDetails?.shippingRate?.value;
    if (shipping !== undefined) {
      const num = parseFloat(shipping);
      if (!isNaN(num)) return num;
    }
  }
  // Only return an explicit shipping COST tied to the product. Heavy goods
  // (aquariums) usually carry a Sperrgut/bulky surcharge. We do NOT assume
  // free shipping from generic "kostenloser Versand" text, because that text
  // appears on pages for unrelated reasons (free over X, other items, etc).
  const shippingPatterns = [
    /Sperrgut[^\d]{0,80}?([\d]+[,\.][\d]{2})\s*€/i,
    /Speditionsversand[^\d]{0,80}?([\d]+[,\.][\d]{2})\s*€/i,
    /Versandkosten\s*(?:von|:|betragen)?[^\d]{0,25}?([\d]+[,\.][\d]{2})\s*€/i,
    /zzgl\.?\s*([\d]+[,\.][\d]{2})\s*€\s*Versand/i,
  ];
  for (const p of shippingPatterns) {
    const m = html.match(p);
    if (m) {
      const num = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(num) && num > 0 && num < 500) return num;
    }
  }
  // Explicit free shipping ONLY if stated right next to the product price area
  // via structured data handled above. Otherwise leave unknown.
  return null;
}

// Universal scraper - tries all known methods
async function universalScrape(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  let priceNum = null;
  let available = null;

  // Method 1: JSON-LD structured data
  const jsonLds = $('script[type="application/ld+json"]').toArray()
    .map(el => { try { return JSON.parse($(el).html()); } catch { return null; } })
    .filter(Boolean);
  for (const jsonLd of jsonLds) {
    const offers = jsonLd.offers || (jsonLd['@graph'] || []).find(g => g.offers)?.offers;
    if (offers?.price) {
      const num = parseFloat(offers.price);
      if (num > 1) { priceNum = num; available = offers.availability?.includes('InStock') ?? null; break; }
    }
  }

  // Method 2: Open Graph / meta product price
  if (priceNum === null) {
    const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
                      $('meta[name="price"]').attr('content') ||
                      $('meta[property="og:price:amount"]').attr('content');
    if (metaPrice) {
      const num = parseFloat(metaPrice);
      if (num > 1) priceNum = num;
    }
  }

  // Method 3: Common CSS selectors
  if (priceNum === null) {
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
      if (num && num > 1) { priceNum = num; break; }
    }
  }

  // Method 4: Regex in raw HTML
  if (priceNum === null) {
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
        if (num > 1) { priceNum = num; break; }
      }
    }
  }

  if (priceNum === null) throw new Error('Cena ni najdena (JS stran)');

  // Now extract shipping from the same HTML (no extra cost)
  const shippingNum = extractShipping($, html);

  return {
    price_num: priceNum,
    price: formatPrice(priceNum),
    currency: '€',
    available,
    shipping_num: shippingNum,
  };
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

// Hornbach specific - extract article number and call API
export async function scrapeHornbachDirect(url) {
  try {
    // Extract article number from URL like /p/.../6289348/
    const match = url.match(/\/(\d{6,8})\/?$/);
    if (!match) throw new Error('Artikel številka ni najdena v URL-ju');
    
    const artNr = match[1];
    const domain = new URL(url).hostname; // hornbach.at or hornbach.de
    const country = domain.includes('.at') ? 'at' : domain.includes('.ch') ? 'ch' : 'de';
    
    let priceNum = null;
    // Try Hornbach's internal API (guard against HTML responses)
    try {
      const apiUrl = `https://www.hornbach.${country}/api/products/${artNr}/prices`;
      const resp = await fetch(apiUrl, {
        headers: { ...HEADERS, 'Accept': 'application/json' },
        redirect: 'follow'
      });
      const ct = resp.headers.get('content-type') || '';
      if (resp.ok && ct.includes('json')) {
        const data = await resp.json();
        const price = data?.grossPrice?.value || data?.price?.value || data?.finalPrice;
        if (price) priceNum = parseFloat(price);
      }
    } catch { /* ignore, fall back to page scraping */ }

    // Fetch page (for shipping, and price fallback)
    const html = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html',
      }
    }).then(r => r.text()).catch(() => '');

    let $hb = null;
    if (html) {
      const cheerioMod = await import('cheerio');
      $hb = cheerioMod.load(html);
    }
    if (priceNum === null && $hb) {
      // Try JSON-LD first
      const jsonLds = $hb('script[type="application/ld+json"]').toArray()
        .map(el => { try { return JSON.parse($hb(el).html()); } catch { return null; } })
        .filter(Boolean);
      for (const j of jsonLds) {
        const offers = j.offers || (j['@graph'] || []).find(g => g.offers)?.offers;
        if (offers?.price) { const n = parseFloat(offers.price); if (n > 1) { priceNum = n; break; } }
      }
    }
    if (priceNum === null && html) {
      const m = html.match(/["']price["']\s*[:\s]+["']?([\d]+[,\.][\d]{2})["']?/);
      if (m) { const n = parseFloat(m[1].replace(',', '.')); if (n > 1) priceNum = n; }
    }

    if (priceNum === null) throw new Error('Cena ni najdena');

    // Shipping - Hornbach shows "Sperrgut ... 49,99 €" for aquariums
    let shippingNum = null;
    if ($hb) {
      shippingNum = extractShipping($hb, html);
    }

    return { price_num: priceNum, price: formatPrice(priceNum), currency: '€', available: true, shipping_num: shippingNum };
  } catch (err) {
    return { price_num: null, price: null, currency: '€', available: null, error: err.message };
  }
}
