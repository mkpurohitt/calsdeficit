import "server-only";

/**
 * Hero image lookup for text-only food scans (the user typed "2 rotis" with no
 * photo, so the card would otherwise open with nothing to look at).
 *
 * Source is Wikipedia/Wikimedia Commons: no API key, no rate-limit contract to
 * sign, and every file is freely licensed — which matters because we render it
 * in a monetized card. We keep the attribution string alongside the URL and
 * display it under the image.
 *
 * Results are memoized per server instance; food names repeat constantly and
 * this keeps the extra latency off the common path.
 */

export interface FoodImage {
  url: string;
  attribution: string;
  page?: string;
}

const CACHE = new Map<string, FoodImage | null>();
const CACHE_MAX = 500;
const TIMEOUT_MS = 3500;
// Wikimedia asks for a descriptive UA on API traffic.
const UA = "Calolean/1.0 (https://calolean.com; nutrition app) food-image-lookup";

function remember(key: string, value: FoodImage | null): FoodImage | null {
  if (CACHE.size >= CACHE_MAX) {
    const oldest = CACHE.keys().next().value;
    if (oldest !== undefined) CACHE.delete(oldest);
  }
  CACHE.set(key, value);
  return value;
}

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Strip parentheticals/portion noise so "2 Rotis (~90 g)" searches as "roti". */
function normalizeQuery(foodName: string): string {
  return foodName
    .replace(/\([^)]*\)/g, " ")
    .replace(/[~\d]+\s*(g|kg|ml|l|grams?|kcal)\b/gi, " ")
    .replace(/\b(homemade|fresh|cooked|boiled|raw|plain|serving|portion|plate|bowl|cup)\b/gi, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Wikipedia page image — best relevance, already a clean food photo. */
async function fromWikipedia(query: string): Promise<FoodImage | null> {
  const search = (await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
      `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=3&gsrnamespace=0` +
      `&prop=pageimages&piprop=thumbnail|name&pithumbsize=640`
  )) as { query?: { pages?: Record<string, { title?: string; thumbnail?: { source?: string } }> } } | null;

  const pages = search?.query?.pages;
  if (!pages) return null;
  for (const page of Object.values(pages)) {
    const src = page?.thumbnail?.source;
    if (src) {
      return {
        url: src,
        attribution: `Wikipedia — ${page.title ?? query}`,
        page: page.title ? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}` : undefined,
      };
    }
  }
  return null;
}

/** Commons file search — broader catalogue for dishes without an article. */
async function fromCommons(query: string): Promise<FoodImage | null> {
  const data = (await getJson(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
      `&generator=search&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}` +
      `&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640`
  )) as {
    query?: {
      pages?: Record<string, {
        title?: string;
        imageinfo?: { thumburl?: string; url?: string; descriptionurl?: string; extmetadata?: { Artist?: { value?: string }; LicenseShortName?: { value?: string } } }[];
      }>;
    };
  } | null;

  const pages = data?.query?.pages;
  if (!pages) return null;
  for (const page of Object.values(pages)) {
    const info = page?.imageinfo?.[0];
    const url = info?.thumburl || info?.url;
    if (!url) continue;
    const artist = (info?.extmetadata?.Artist?.value || "").replace(/<[^>]*>/g, "").trim();
    const licence = (info?.extmetadata?.LicenseShortName?.value || "").trim();
    return {
      url,
      attribution: ["Wikimedia Commons", artist, licence].filter(Boolean).join(" · "),
      page: info?.descriptionurl,
    };
  }
  return null;
}

/**
 * Best-effort hero image for a food name. Always resolves (null on miss) so a
 * lookup failure can never break a scan.
 */
export async function findFoodImage(foodName: string): Promise<FoodImage | null> {
  const query = normalizeQuery(foodName);
  if (!query || query.length < 2) return null;
  if (CACHE.has(query)) return CACHE.get(query) ?? null;

  try {
    const hit = (await fromWikipedia(query)) || (await fromCommons(query));
    return remember(query, hit);
  } catch (error) {
    console.error("[food-image] lookup failed:", error);
    return remember(query, null);
  }
}
