/**
 * Stock media library for landing pages (docs/PAGE_COMPONENT_REGISTRY.md#stock-media).
 *
 * Curated, free-license photos (Unsplash License) and videos (Pexels License)
 * of UAE cityscapes, residences and amenities. Pages reference them by catalog
 * ID only; the URL is built here from fixed hosts, so a page can never point
 * at an arbitrary address. Stock media is illustrative: it does not show the
 * advertised property, pages label it as such, and the publication checklist
 * asks the publisher to confirm it before publishing. Replace it with approved
 * project photos in the editor whenever they exist.
 *
 * Files are hotlinked from the providers' CDNs (no repository weight). For
 * production, copy the chosen files to your own storage if you prefer not to
 * depend on third-party CDNs (see docs).
 */

export const STOCK_TAGS = [
  "SKYLINE", "MARINA", "BEACH", "ISLAND", "ABU_DHABI", "NIGHT", "VILLA", "LIVING_ROOM", "BEDROOM", "KITCHEN", "BATHROOM",
  "POOL", "GYM", "SPA", "PARK", "ADVISOR", "ARCHITECTURE",
] as const;
export type StockTag = (typeof STOCK_TAGS)[number];

export const STOCK_TAG_LABELS: Record<StockTag, string> = {
  SKYLINE: "City skyline", MARINA: "Marina & waterfront", BEACH: "Beach", ISLAND: "Islands & aerials", ABU_DHABI: "Abu Dhabi", NIGHT: "City at night",
  VILLA: "Villas", LIVING_ROOM: "Living rooms", BEDROOM: "Bedrooms", KITCHEN: "Kitchens", BATHROOM: "Bathrooms", POOL: "Pools", GYM: "Fitness",
  SPA: "Spa & wellness", PARK: "Parks & gardens", ADVISOR: "Advisors & handover", ARCHITECTURE: "Architecture",
};

export interface StockImage { id: string; kind: "image"; photo: string; author: string; alt: string; tags: StockTag[] }
export interface StockVideo { id: string; kind: "video"; pexelsId: string; file: string; title: string; poster: string; tags: StockTag[] }

const image = (id: string, photo: string, author: string, alt: string, ...tags: StockTag[]): StockImage => ({id, kind: "image", photo, author, alt, tags});

export const STOCK_IMAGES: StockImage[] = [
  image("skyline-burj-interchange", "1512453979798-5ea266f8880c", "David Rodrigo", "Burj Khalifa and the Downtown Dubai skyline", "SKYLINE"),
  image("skyline-sunset", "1782078292081-8fb6de1c54df", "August Togbor", "Dubai skyline silhouette at sunset", "SKYLINE"),
  image("skyline-aerial-turquoise", "1784285571900-fdd73d3c161a", "Dubai Prod", "Aerial view of Dubai with turquoise water", "SKYLINE", "ISLAND"),
  image("skyline-night-trails", "1784125160488-09f633671243", "Aman Kumar", "Dubai at night with light trails", "SKYLINE", "NIGHT"),
  image("skyline-downtown-lights", "1634007626524-f47fa37810a7", "Ahmed Aldaie", "Illuminated Downtown Dubai skyline", "SKYLINE", "NIGHT"),
  image("skyline-villas-water", "1787401316243-e56a69d9df52", "ft shafi", "Skyscrapers rising above waterfront villas", "SKYLINE", "VILLA"),
  image("marina-night-boats", "1765801122549-2c11dc9cbd78", "Dawid Tkocz", "Marina towers and boats at night", "MARINA", "NIGHT"),
  image("marina-sunset-boat", "1768463852019-4881a17a1c0e", "Dawid Tkocz", "A boat on the marina at sunset", "MARINA"),
  image("marina-towers-sea", "1611577810610-642f8ac05c32", "Emma Harrisova", "High-rise towers by the sea", "MARINA"),
  image("marina-reflections", "1768463852068-cc277b8baf35", "Dawid Tkocz", "Towers reflected in the marina", "MARINA"),
  image("marina-yacht", "1768463852017-921060ff24fe", "Dawid Tkocz", "Yacht passing waterfront towers", "MARINA"),
  image("beach-burj-al-arab", "1518684079-3c830dcef090", "Christoph Schulz", "Beachfront view of Burj Al Arab", "BEACH"),
  image("beach-loungers", "1759745056970-e4ccca6ec5e8", "Michaela J", "Beach loungers with towers behind", "BEACH"),
  image("beach-walk", "1772175057062-b4e8852d7d73", "Damian Kamp", "Walking into the sea with the skyline behind", "BEACH"),
  image("island-resort-aerial", "1786991810391-e28ee367c3aa", "Anubhav Sonker", "Aerial view of an island resort", "ISLAND"),
  image("island-aerial", "1732645023408-6e99df42f09e", "Maximus Mazar", "An island surrounded by clear water", "ISLAND"),
  image("island-aerial-sea", "1640808476588-e96ae8e7a419", "Eslam Tawakol", "Aerial view of an island in the sea", "ISLAND"),
  image("abudhabi-mosque", "1512632578888-169bbbc64f33", "David Rodrigo", "Sheikh Zayed Grand Mosque reflected in water", "ABU_DHABI"),
  image("abudhabi-skyline-lake", "1762687508992-effc04be64b8", "Jean Carlo Emer", "Abu Dhabi skyline with palm trees", "ABU_DHABI", "SKYLINE"),
  image("abudhabi-coast", "1758952327505-d3917528173a", "Po-Hsuan Huang", "Coastal skyline with modern architecture", "ABU_DHABI"),
  image("abudhabi-glass-towers", "1734009775179-07f428483783", "Saeed Alsoomehi", "Glass towers in a warm evening sky", "ABU_DHABI", "ARCHITECTURE"),
  image("villa-white-pool", "1613977257592-4871e5fcd7c4", "John Fornander", "Modern white villa with a swimming pool", "VILLA", "POOL"),
  image("villa-modern-pool", "1706808849780-7a04fbac83ef", "Salman Saqib", "Contemporary villa with pool and loungers", "VILLA", "POOL"),
  image("villa-palms", "1745761320791-5ae142edee8c", "Tim Schmidbauer", "Luxury villa among palm trees", "VILLA"),
  image("villa-mansion", "1756064173162-326c8e85215d", "Adrian Kusznirewicz", "Elegant white mansion with topiaries", "VILLA"),
  image("villa-facade", "1580587771525-78b9dba3b914", "Yaroslav Alekseenko", "White villa facade under a blue sky", "VILLA", "ARCHITECTURE"),
  image("living-window-view", "1758565811176-ccd94357a844", "Caroline Badran", "Living room with large windows and a view", "LIVING_ROOM"),
  image("living-sectional", "1758448511322-8bfc73daf606", "Aalo Lens", "Modern living room with a sectional sofa", "LIVING_ROOM"),
  image("living-marble", "1598928506311-c55ded91a20c", "Lotus Design N Print", "Living room with marble fireplace", "LIVING_ROOM"),
  image("living-neutral", "1618221195710-dd6b41faaea6", "Spacejoy", "Neutral-toned living room", "LIVING_ROOM"),
  image("living-bright", "1600210491892-03d54c0aaf87", "Collov Home Design", "Bright living room with white sofa", "LIVING_ROOM"),
  image("bedroom-city-view", "1616594039964-ae9021a400a0", "Spacejoy", "Bedroom with a city view", "BEDROOM"),
  image("bedroom-luxury", "1765862835193-3c37388a409e", "Puscas Adryan", "Luxurious bedroom with modern furniture", "BEDROOM"),
  image("bedroom-arched", "1766733041960-0de62f403e7b", "Puscas Adryan", "Bedroom with arched headboard", "BEDROOM"),
  image("kitchen-marble", "1671197244266-73129c97c096", "Medea Dzagnidze", "Modern kitchen with marble counters", "KITCHEN"),
  image("kitchen-island", "1759147960461-b74a7e9a75d4", "Alina Tramontana", "Kitchen island with bar stools", "KITCHEN"),
  image("kitchen-white", "1600489000022-c2086d79f9d4", "Collov Home Design", "White and wood kitchen", "KITCHEN"),
  image("bathroom-freestanding", "1781344334947-60c704bafd51", "Ibrar Tariq", "Bathroom with freestanding tub", "BATHROOM"),
  image("bathroom-marble", "1765745518673-b562b7304a53", "Puscas Adryan", "Marble and wood bathroom", "BATHROOM"),
  image("pool-infinity-bay", "1543489822-c49534f3271f", "big.tiny.belly", "Infinity pool overlooking a bay", "POOL"),
  image("pool-ocean", "1713843841925-6af6ed0df472", "Milin John", "Swimming pool with an ocean view", "POOL"),
  image("pool-lounge", "1729003702131-51807464dcec", "Nereid Ndreu", "Large pool with a lounge chair", "POOL", "SPA"),
  image("gym-city-view", "1758448756350-3d0eec02ba37", "Aalo Lens", "Gym with a city view", "GYM"),
  image("gym-treadmills", "1757924284732-4189190321cf", "Aalo Lens", "Modern gym with treadmills", "GYM"),
  image("yoga-studio", "1761971975962-9cc397e2ba2a", "eran design", "Yoga studio with large windows", "GYM", "SPA"),
  image("spa-stones", "1600334089648-b0d9d3028eb2", "Engin Akyurt", "Hot stone spa treatment", "SPA"),
  image("spa-candles", "1706795033849-7ca391f007c5", "Anna Keibalo", "Spa table with candles and towels", "SPA"),
  image("park-palms", "1629074401053-1148a9798d27", "Oxana Melis", "Green lawn with palm trees", "PARK"),
  image("park-path", "1773932480234-8749604568ea", "Livvi Grant", "Tree-lined park path", "PARK"),
  image("park-bench", "1674880790397-035ff15dac33", "Sean Foster", "Bench in a lush green park", "PARK"),
  image("advisor-keys", "1781229771042-2a859f8f8022", "Tuấn 123", "Handshake over a house model and keys", "ADVISOR"),
  image("advisor-table", "1758518730384-be3d205838e8", "Vitaly Gariev", "Professionals shaking hands across a table", "ADVISOR"),
  image("advisor-deal", "1752159684779-0639174cdfac", "Ambre Estève", "Business partners shaking hands", "ADVISOR"),
  image("architecture-curves", "1783685158056-f420c0d65221", "Alexander Kaufmann", "Curved modern architecture", "ARCHITECTURE"),
  image("architecture-white-palms", "1783685158044-6892424e93c8", "Alexander Kaufmann", "White modern buildings with palm fronds", "ARCHITECTURE"),
];

const video = (id: string, pexelsId: string, file: string, title: string, poster: string, ...tags: StockTag[]): StockVideo => ({id, kind: "video", pexelsId, file, title, poster, tags});

export const STOCK_VIDEOS: StockVideo[] = [
  video("video-dubai-shore", "10567969", "hd_1280_720_30fps", "Skyscrapers on the Dubai shoreline", "skyline-aerial-turquoise", "SKYLINE", "BEACH"),
  video("video-dubai-mosque-towers", "10580463", "hd_1280_720_30fps", "Mosque among Dubai skyscrapers", "skyline-burj-interchange", "SKYLINE"),
  video("video-dubai-creek", "7169072", "sd_960_540_25fps", "Boats on Dubai Creek", "marina-sunset-boat", "MARINA"),
  video("video-rooftop-pool", "19773860", "hd_1280_720_25fps", "Rooftop pool overlooking the city", "pool-infinity-bay", "POOL", "SKYLINE"),
  video("video-infinity-pool", "4531362", "sd_960_540_30fps", "Infinity pool time-lapse", "pool-ocean", "POOL"),
  video("video-living-white", "16454952", "hd_1280_720_60fps", "Living room with white furniture", "living-bright", "LIVING_ROOM"),
  video("video-living-minimal", "10135156", "hd_1280_720_30fps", "Minimalist living room", "living-neutral", "LIVING_ROOM"),
  video("video-living-modern", "7533207", "hd_1280_720_60fps", "Modern living room", "living-sectional", "LIVING_ROOM"),
];

const imagesById = new Map(STOCK_IMAGES.map(item => [item.id, item]));
const videosById = new Map(STOCK_VIDEOS.map(item => [item.id, item]));

export const isStockImageId = (id: string) => imagesById.has(id);
export const isStockVideoId = (id: string) => videosById.has(id);
export const stockImage = (id: string) => imagesById.get(id) ?? null;
export const stockVideo = (id: string) => videosById.get(id) ?? null;

/** Fixed-host URL for a catalog photo at a given width. */
export function stockImageUrl(item: StockImage, width = 1600) {
  return `https://images.unsplash.com/photo-${item.photo}?auto=format&fit=crop&w=${width}&q=78`;
}
export function stockImageSrcSet(item: StockImage) {
  return [640, 960, 1280, 1920, 2560].map(width => `${stockImageUrl(item, width)} ${width}w`).join(", ");
}
export function stockVideoUrl(item: StockVideo) {
  return `https://videos.pexels.com/video-files/${item.pexelsId}/${item.pexelsId}-${item.file}.mp4`;
}
export function stockCredit(item: StockImage | StockVideo) {
  return item.kind === "image"
    ? {text: `Photo: ${item.author} / Unsplash`, href: `https://unsplash.com/photos/${item.photo}`}
    : {text: "Video: Pexels", href: `https://www.pexels.com/video/${item.pexelsId}/`};
}

/** Deterministic picks so the same page always gets the same images. */
export function stockImagesFor(tag: StockTag, count = 1, offset = 0): StockImage[] {
  const pool = STOCK_IMAGES.filter(item => item.tags.includes(tag));
  if (!pool.length) return [];
  return Array.from({length: Math.min(count, pool.length)}, (_, index) => pool[(index + offset) % pool.length]);
}
export function stockVideoFor(tag: StockTag) {
  return STOCK_VIDEOS.find(item => item.tags.includes(tag)) ?? STOCK_VIDEOS[0];
}

/** Amenity names to the stock photo that illustrates them (illustrative only). */
const AMENITY_TAGS: Array<[RegExp, StockTag]> = [
  [/pool|swim|lagoon|aqua/i, "POOL"], [/gym|fitness|yoga|sport|court|padel|tennis/i, "GYM"], [/spa|sauna|steam|wellness|jacuzzi/i, "SPA"],
  [/park|garden|green|landscap|jog|walk|kids|play|bbq/i, "PARK"], [/beach|sea|marina|water/i, "BEACH"], [/lounge|lobby|concierge|club/i, "LIVING_ROOM"],
];
export function amenityStockTag(name: string): StockTag {
  return AMENITY_TAGS.find(([pattern]) => pattern.test(name))?.[1] ?? "ARCHITECTURE";
}
