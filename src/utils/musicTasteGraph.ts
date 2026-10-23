// src/utils/musicTasteGraph.ts
// Intelligent music taste similarity graph, junk track filtering, and diversity engine.

// Broad clusters of related artists for taste-based discovery
const ARTIST_CLUSTERS: Record<string, string[]> = {
  // Indie Pop / Bedroom Pop / Dream Pop / Chill Indie
  indie_pop: [
    "Cafuné",
    "Vacations",
    "Beach Bunny",
    "Clairo",
    "Wallows",
    "Dayglow",
    "Boy Pablo",
    "Men I Trust",
    "The Marías",
    "Current Joys",
    "Cuco",
    "Beabadoobee",
    "Rex Orange County",
    "TV Girl",
    "Alvvays",
    "Mac DeMarco",
    "Dominic Fike",
    "Still Woozy",
    "Peach Pit",
    "Mitski",
    "Cavetown",
    "Phoebe Bridgers",
    "Omar Apollo",
    "Gus Dapperton",
    "Steve Lacy",
    "Faye Webster",
    "Her's",
    "Djo",
    "Surf Curse",
  ],

  // Indie Rock / Post-Punk / Alt-Rock
  indie_rock: [
    "Arctic Monkeys",
    "The Strokes",
    "The Neighbourhood",
    "Cage The Elephant",
    "Foals",
    "Declan McKenna",
    "Two Door Cinema Club",
    "The Black Keys",
    "Franz Ferdinand",
    "Glass Animals",
    "Sam Fender",
    "Fontaines D.C.",
    "Interpol",
    "Phoenix",
    "The Kooks",
    "Vampire Weekend",
    "Catfish and the Bottlemen",
    "The 1975",
    "Foster the People",
    "Young the Giant",
    "Bleachers",
  ],

  // Synthwave / Retrowave / French Electro / Nu-Disco
  synthwave: [
    "Daft Punk",
    "Kavinsky",
    "The Midnight",
    "Gunship",
    "Carpenter Brut",
    "Timecop1983",
    "FM-84",
    "Mitch Murder",
    "Perturbator",
    "Trevor Something",
    "Lorn",
    "HOME",
    "Justice",
    "Empire of the Sun",
    "Breakbot",
    "Parcels",
    "Miami Nights 1984",
    "Com Truise",
    "M83",
    "CHVRCHES",
  ],

  // Modern R&B / Neo-Soul / Melodic Mood
  rnb_soul: [
    "The Weeknd",
    "Frank Ocean",
    "SZA",
    "Daniel Caesar",
    "Brent Faiyaz",
    "Joji",
    "Giveon",
    "Kali Uchis",
    "Steve Lacy",
    "Childish Gambino",
    "Bruno Mars",
    "Silk Sonic",
    "Miguel",
    "Snoh Aalegra",
    "Leon Bridges",
    "Sampha",
    "Summer Walker",
    "6LACK",
    "H.E.R.",
    "Partynextdoor",
  ],

  // Hip-Hop / Conscious Rap / Modern Melodic Trap
  hip_hop: [
    "Kendrick Lamar",
    "J. Cole",
    "Travis Scott",
    "Drake",
    "Tyler, The Creator",
    "A$AP Rocky",
    "Post Malone",
    "Metro Boomin",
    "21 Savage",
    "Don Toliver",
    "Denzel Curry",
    "Mac Miller",
    "Joey Bada$$",
    "Kid Cudi",
    "Baby Keem",
    "Schoolboy Q",
    "Saba",
    "Aminé",
    "Smino",
  ],

  // Electronic / House / UK Bass / Dance
  electronic: [
    "Fred again..",
    "Skrillex",
    "Bicep",
    "Disclosure",
    "ODESZA",
    "Flume",
    "Deadmau5",
    "RÜFÜS DU SOL",
    "Peggy Gou",
    "Four Tet",
    "Porter Robinson",
    "Madeon",
    "Kaytranada",
    "San Holo",
    "Bonobo",
    "Lane 8",
    "Jamie xx",
    "Overmono",
    "Caribou",
  ],

  // Modern Pop / Alt-Pop / Mainstream Hits
  pop: [
    "Dua Lipa",
    "Billie Eilish",
    "Olivia Rodrigo",
    "Charli XCX",
    "Lorde",
    "Chappell Roan",
    "Sabrina Carpenter",
    "Troye Sivan",
    "Tate McRae",
    "Gracie Abrams",
    "Conan Gray",
    "Renee Rapp",
    "Taylor Swift",
    "Ariana Grande",
    "Harry Styles",
    "Lana Del Rey",
  ],

  // Rock / Grunge / 90s Alt / Metal
  rock_grunge: [
    "Nirvana",
    "Radiohead",
    "Deftones",
    "Linkin Park",
    "Red Hot Chili Peppers",
    "Foo Fighters",
    "Green Day",
    "Muse",
    "Queens of the Stone Age",
    "System of a Down",
    "Alice in Chains",
    "Smashing Pumpkins",
    "Soundgarden",
    "Pearl Jam",
    "Weezer",
    "Loathe",
    "Chevelle",
  ],

  // Lo-Fi / Chillhop / Study Beats
  lofi_chill: [
    "Idealism",
    "Jinsang",
    "Kudasaibeats",
    "Tomppabeats",
    "Potsu",
    "Saib",
    "Elijah Who",
    "Kupla",
    "SwuM",
    "Purrple Cat",
    "Nujabes",
    "L.Dre",
    "Knxwledge",
    "Flovry",
  ],

  // Japanese / City Pop / Asian Indie
  asian_indie: [
    "Miki Matsubara",
    "Tatsuro Yamashita",
    "Mariya Takeuchi",
    "Lamp",
    "Fujii Kaze",
    "RADWIMPS",
    "YOASOBI",
    "Vaundy",
    "King Gnu",
    "Eve",
    "Aimyon",
    "Ado",
    "Kenshi Yonezu",
  ],
};

// Normalized lookup index for O(1) cluster discovery
const ARTIST_TO_CLUSTER: Map<string, string> = new Map();

for (const [clusterKey, artists] of Object.entries(ARTIST_CLUSTERS)) {
  for (const artist of artists) {
    ARTIST_TO_CLUSTER.set(normalizeText(artist), clusterKey);
  }
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics (e.g. é -> e)
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Returns a list of artists similar to the given artist.
 * If the artist is found in a cluster, returns other artists from that cluster.
 * If not, attempts partial matching or falls back to an eclectic variety.
 */
export function getSimilarArtists(artistName: string): string[] {
  const norm = normalizeText(artistName);
  if (!norm) return [];

  // 1. Direct match in cluster index
  let clusterKey = ARTIST_TO_CLUSTER.get(norm);

  // 2. Fuzzy substring match if direct match fails
  if (!clusterKey) {
    for (const [indexedNorm, key] of ARTIST_TO_CLUSTER.entries()) {
      if (indexedNorm.includes(norm) || norm.includes(indexedNorm)) {
        clusterKey = key;
        break;
      }
    }
  }

  if (clusterKey && ARTIST_CLUSTERS[clusterKey]) {
    // Return other artists from the same cluster (excluding the original)
    const cluster = ARTIST_CLUSTERS[clusterKey];
    const filtered = cluster.filter((a) => normalizeText(a) !== norm);
    // Shuffle to provide fresh discovery each time
    return [...filtered].sort(() => 0.5 - Math.random());
  }

  return [];
}

/**
 * Strips title variations like (Sped Up), [Slowed + Reverb], feat., etc.
 * to compare if two songs are the same core track.
 */
export function normalizeSongTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)/g, "") // remove parentheticals: (sped up), (feat. x), (remix)
    .replace(/\[.*?\]/g, "") // remove brackets: [slowed], [official video]
    .replace(/-\s*(sped up|slowed|reverb|remix|acoustic|live|radio edit|remastered).*$/i, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Detects low-quality variants, karaoke, sped up, slowed, tributes, ringtones, etc.
 */
export function isJunkTrack(title: string): boolean {
  const lower = title.toLowerCase();
  const junkPatterns = [
    /\b(sped up|speed up|slowed|reverb|nightcore|karaoke|instrumental|tribute|ringtone|8d audio)\b/i,
    /\b(cover version|lofi remix|dance remix|workout remix|piano tribute)\b/i,
    /\b(interlude|intro|outro|skit)\b/i,
  ];

  return junkPatterns.some((pattern) => pattern.test(lower));
}

/**
 * Verifies that the track returned by search actually belongs to the query artist,
 * preventing unrelated songs whose song title happens to match the artist's name.
 */
export function isArtistMatch(queryArtist: string, trackArtist: string): boolean {
  const q = normalizeText(queryArtist);
  const t = normalizeText(trackArtist);
  if (!q || !t) return false;
  return t.includes(q) || q.includes(t);
}

/**
 * Core Recommendation Pipeline:
 * Takes candidate tracks fetched from search queries, filters out junk/duplicates/library tracks,
 * and enforces MAX 1 TRACK PER ARTIST to guarantee vibrant diversity.
 */
export function filterAndDiversifyRecommendations<
  T extends { id: string; title: string; artist: string }
>(
  candidates: Array<{ queryArtist: string; track: T }>,
  libraryTrackTitles: Set<string>,
  maxCount: number = 7
): T[] {
  const seenNormTitles = new Set<string>();
  const seenArtists = new Set<string>();
  const seenIds = new Set<string>();

  // Populate library titles to prevent recommending existing songs
  for (const title of libraryTrackTitles) {
    seenNormTitles.add(normalizeSongTitle(title));
  }

  // Group candidate tracks by artist to allow balanced round-robin selection
  const tracksByArtist = new Map<string, T[]>();

  for (const { queryArtist, track } of candidates) {
    if (!track.title || !track.artist || seenIds.has(track.id)) continue;

    // 1. Must actually be by the target artist (avoids songs whose title happens to match the artist name)
    if (!isArtistMatch(queryArtist, track.artist)) {
      continue;
    }

    // 2. Filter out junk variants (sped up, slowed, karaoke, etc.)
    if (isJunkTrack(track.title)) {
      continue;
    }

    // 3. Filter out songs already in library or already added
    const normTitle = normalizeSongTitle(track.title);
    if (!normTitle || seenNormTitles.has(normTitle)) {
      continue;
    }

    seenIds.add(track.id);

    const normArtist = normalizeText(track.artist);
    const existing = tracksByArtist.get(normArtist) || [];
    existing.push(track);
    tracksByArtist.set(normArtist, existing);
  }

  // Interleave tracks across artists (round-robin)
  const result: T[] = [];
  const artistLists = Array.from(tracksByArtist.values());

  let round = 0;
  let addedInRound = true;

  while (result.length < maxCount && addedInRound) {
    addedInRound = false;
    for (const list of artistLists) {
      if (result.length >= maxCount) break;
      if (round < list.length) {
        const track = list[round];
        const normArtist = normalizeText(track.artist);

        // Cap at 1 track per artist for maximum diversity in the first row
        if (round === 0 || !seenArtists.has(normArtist)) {
          seenArtists.add(normArtist);
          seenNormTitles.add(normalizeSongTitle(track.title));
          result.push(track);
          addedInRound = true;
        }
      }
    }
    round++;
  }

  // If still under maxCount (e.g. user has very few artists), allow a second track per artist
  if (result.length < maxCount) {
    for (const list of artistLists) {
      for (let i = 1; i < list.length && result.length < maxCount; i++) {
        const track = list[i];
        const normTitle = normalizeSongTitle(track.title);
        if (!seenNormTitles.has(normTitle)) {
          seenNormTitles.add(normTitle);
          result.push(track);
        }
      }
    }
  }

  return result;
}
