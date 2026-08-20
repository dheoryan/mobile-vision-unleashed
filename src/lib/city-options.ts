export type WorldCity = {
  city: string;
  country: string;
  region: "Africa" | "Asia" | "Europe" | "Middle East" | "North America" | "Oceania" | "South America";
  /** City-centre coordinates, used to derive a person's city from their
   *  location without calling a geocoding service. Two decimals is ~1 km,
   *  which is far finer than "which of these cities are you nearest to". */
  lat: number;
  lon: number;
};

// A deliberately local, dependency-free catalog keeps profile values consistent
// and avoids sending every search query to a third-party geocoding service.
export const WORLD_CITIES: readonly WorldCity[] = [
  { city: "Abidjan", country: "Côte d’Ivoire", region: "Africa", lat: 5.35, lon: -4.03 },
  { city: "Accra", country: "Ghana", region: "Africa", lat: 5.6, lon: -0.19 },
  { city: "Addis Ababa", country: "Ethiopia", region: "Africa", lat: 9.03, lon: 38.74 },
  { city: "Alexandria", country: "Egypt", region: "Africa", lat: 31.2, lon: 29.92 },
  { city: "Cairo", country: "Egypt", region: "Africa", lat: 30.04, lon: 31.24 },
  { city: "Cape Town", country: "South Africa", region: "Africa", lat: -33.92, lon: 18.42 },
  { city: "Casablanca", country: "Morocco", region: "Africa", lat: 33.57, lon: -7.59 },
  { city: "Dakar", country: "Senegal", region: "Africa", lat: 14.72, lon: -17.47 },
  { city: "Dar es Salaam", country: "Tanzania", region: "Africa", lat: -6.79, lon: 39.21 },
  { city: "Johannesburg", country: "South Africa", region: "Africa", lat: -26.2, lon: 28.05 },
  { city: "Kampala", country: "Uganda", region: "Africa", lat: 0.32, lon: 32.58 },
  { city: "Kigali", country: "Rwanda", region: "Africa", lat: -1.94, lon: 30.06 },
  { city: "Lagos", country: "Nigeria", region: "Africa", lat: 6.52, lon: 3.38 },
  { city: "Nairobi", country: "Kenya", region: "Africa", lat: -1.29, lon: 36.82 },
  { city: "Tunis", country: "Tunisia", region: "Africa", lat: 36.81, lon: 10.18 },
  { city: "Almaty", country: "Kazakhstan", region: "Asia", lat: 43.24, lon: 76.89 },
  { city: "Bandung", country: "Indonesia", region: "Asia", lat: -6.91, lon: 107.61 },
  { city: "Bangkok", country: "Thailand", region: "Asia", lat: 13.76, lon: 100.5 },
  { city: "Beijing", country: "China", region: "Asia", lat: 39.9, lon: 116.41 },
  { city: "Bengaluru", country: "India", region: "Asia", lat: 12.97, lon: 77.59 },
  { city: "Busan", country: "South Korea", region: "Asia", lat: 35.18, lon: 129.08 },
  { city: "Cebu City", country: "Philippines", region: "Asia", lat: 10.32, lon: 123.89 },
  { city: "Chennai", country: "India", region: "Asia", lat: 13.08, lon: 80.27 },
  { city: "Chiang Mai", country: "Thailand", region: "Asia", lat: 18.79, lon: 98.99 },
  { city: "Da Nang", country: "Vietnam", region: "Asia", lat: 16.05, lon: 108.2 },
  { city: "Delhi", country: "India", region: "Asia", lat: 28.61, lon: 77.21 },
  { city: "Denpasar", country: "Indonesia", region: "Asia", lat: -8.65, lon: 115.22 },
  { city: "Dhaka", country: "Bangladesh", region: "Asia", lat: 23.81, lon: 90.41 },
  { city: "Guangzhou", country: "China", region: "Asia", lat: 23.13, lon: 113.26 },
  { city: "Hanoi", country: "Vietnam", region: "Asia", lat: 21.03, lon: 105.85 },
  { city: "Ho Chi Minh City", country: "Vietnam", region: "Asia", lat: 10.82, lon: 106.63 },
  { city: "Hong Kong", country: "Hong Kong", region: "Asia", lat: 22.32, lon: 114.17 },
  { city: "Hyderabad", country: "India", region: "Asia", lat: 17.39, lon: 78.49 },
  { city: "Incheon", country: "South Korea", region: "Asia", lat: 37.46, lon: 126.71 },
  { city: "Jakarta", country: "Indonesia", region: "Asia", lat: -6.21, lon: 106.85 },
  { city: "Kathmandu", country: "Nepal", region: "Asia", lat: 27.72, lon: 85.32 },
  { city: "Kuala Lumpur", country: "Malaysia", region: "Asia", lat: 3.14, lon: 101.69 },
  { city: "Kyoto", country: "Japan", region: "Asia", lat: 35.01, lon: 135.77 },
  { city: "Lahore", country: "Pakistan", region: "Asia", lat: 31.55, lon: 74.34 },
  { city: "Macau", country: "Macau", region: "Asia", lat: 22.2, lon: 113.54 },
  { city: "Makassar", country: "Indonesia", region: "Asia", lat: -5.15, lon: 119.43 },
  { city: "Manila", country: "Philippines", region: "Asia", lat: 14.6, lon: 120.98 },
  { city: "Medan", country: "Indonesia", region: "Asia", lat: 3.59, lon: 98.67 },
  { city: "Mumbai", country: "India", region: "Asia", lat: 19.08, lon: 72.88 },
  { city: "Nagoya", country: "Japan", region: "Asia", lat: 35.18, lon: 136.91 },
  { city: "Osaka", country: "Japan", region: "Asia", lat: 34.69, lon: 135.5 },
  { city: "Phnom Penh", country: "Cambodia", region: "Asia", lat: 11.56, lon: 104.92 },
  { city: "Seoul", country: "South Korea", region: "Asia", lat: 37.57, lon: 126.98 },
  { city: "Shanghai", country: "China", region: "Asia", lat: 31.23, lon: 121.47 },
  { city: "Shenzhen", country: "China", region: "Asia", lat: 22.54, lon: 114.06 },
  { city: "Singapore", country: "Singapore", region: "Asia", lat: 1.35, lon: 103.82 },
  { city: "Surabaya", country: "Indonesia", region: "Asia", lat: -7.25, lon: 112.75 },
  { city: "Taipei", country: "Taiwan", region: "Asia", lat: 25.03, lon: 121.57 },
  { city: "Tokyo", country: "Japan", region: "Asia", lat: 35.68, lon: 139.69 },
  { city: "Ulaanbaatar", country: "Mongolia", region: "Asia", lat: 47.89, lon: 106.91 },
  { city: "Yogyakarta", country: "Indonesia", region: "Asia", lat: -7.8, lon: 110.36 },
  { city: "Amsterdam", country: "Netherlands", region: "Europe", lat: 52.37, lon: 4.9 },
  { city: "Athens", country: "Greece", region: "Europe", lat: 37.98, lon: 23.73 },
  { city: "Barcelona", country: "Spain", region: "Europe", lat: 41.39, lon: 2.17 },
  { city: "Belgrade", country: "Serbia", region: "Europe", lat: 44.79, lon: 20.45 },
  { city: "Berlin", country: "Germany", region: "Europe", lat: 52.52, lon: 13.4 },
  { city: "Brussels", country: "Belgium", region: "Europe", lat: 50.85, lon: 4.35 },
  { city: "Bucharest", country: "Romania", region: "Europe", lat: 44.43, lon: 26.1 },
  { city: "Budapest", country: "Hungary", region: "Europe", lat: 47.5, lon: 19.04 },
  { city: "Copenhagen", country: "Denmark", region: "Europe", lat: 55.68, lon: 12.57 },
  { city: "Dublin", country: "Ireland", region: "Europe", lat: 53.35, lon: -6.26 },
  { city: "Edinburgh", country: "United Kingdom", region: "Europe", lat: 55.95, lon: -3.19 },
  { city: "Helsinki", country: "Finland", region: "Europe", lat: 60.17, lon: 24.94 },
  { city: "Istanbul", country: "Türkiye", region: "Europe", lat: 41.01, lon: 28.98 },
  { city: "Lisbon", country: "Portugal", region: "Europe", lat: 38.72, lon: -9.14 },
  { city: "London", country: "United Kingdom", region: "Europe", lat: 51.51, lon: -0.13 },
  { city: "Madrid", country: "Spain", region: "Europe", lat: 40.42, lon: -3.7 },
  { city: "Manchester", country: "United Kingdom", region: "Europe", lat: 53.48, lon: -2.24 },
  { city: "Milan", country: "Italy", region: "Europe", lat: 45.46, lon: 9.19 },
  { city: "Munich", country: "Germany", region: "Europe", lat: 48.14, lon: 11.58 },
  { city: "Oslo", country: "Norway", region: "Europe", lat: 59.91, lon: 10.75 },
  { city: "Paris", country: "France", region: "Europe", lat: 48.86, lon: 2.35 },
  { city: "Prague", country: "Czechia", region: "Europe", lat: 50.08, lon: 14.44 },
  { city: "Rome", country: "Italy", region: "Europe", lat: 41.9, lon: 12.5 },
  { city: "Stockholm", country: "Sweden", region: "Europe", lat: 59.33, lon: 18.07 },
  { city: "Vienna", country: "Austria", region: "Europe", lat: 48.21, lon: 16.37 },
  { city: "Warsaw", country: "Poland", region: "Europe", lat: 52.23, lon: 21.01 },
  { city: "Zurich", country: "Switzerland", region: "Europe", lat: 47.38, lon: 8.54 },
  { city: "Abu Dhabi", country: "United Arab Emirates", region: "Middle East", lat: 24.45, lon: 54.38 },
  { city: "Amman", country: "Jordan", region: "Middle East", lat: 31.95, lon: 35.93 },
  { city: "Beirut", country: "Lebanon", region: "Middle East", lat: 33.89, lon: 35.5 },
  { city: "Doha", country: "Qatar", region: "Middle East", lat: 25.29, lon: 51.53 },
  { city: "Dubai", country: "United Arab Emirates", region: "Middle East", lat: 25.2, lon: 55.27 },
  { city: "Jeddah", country: "Saudi Arabia", region: "Middle East", lat: 21.49, lon: 39.19 },
  { city: "Kuwait City", country: "Kuwait", region: "Middle East", lat: 29.38, lon: 47.99 },
  { city: "Manama", country: "Bahrain", region: "Middle East", lat: 26.23, lon: 50.59 },
  { city: "Muscat", country: "Oman", region: "Middle East", lat: 23.59, lon: 58.41 },
  { city: "Riyadh", country: "Saudi Arabia", region: "Middle East", lat: 24.71, lon: 46.68 },
  { city: "Tel Aviv", country: "Israel", region: "Middle East", lat: 32.08, lon: 34.78 },
  { city: "Atlanta", country: "United States", region: "North America", lat: 33.75, lon: -84.39 },
  { city: "Austin", country: "United States", region: "North America", lat: 30.27, lon: -97.74 },
  { city: "Boston", country: "United States", region: "North America", lat: 42.36, lon: -71.06 },
  { city: "Chicago", country: "United States", region: "North America", lat: 41.88, lon: -87.63 },
  { city: "Dallas", country: "United States", region: "North America", lat: 32.78, lon: -96.8 },
  { city: "Denver", country: "United States", region: "North America", lat: 39.74, lon: -104.99 },
  { city: "Guadalajara", country: "Mexico", region: "North America", lat: 20.66, lon: -103.35 },
  { city: "Havana", country: "Cuba", region: "North America", lat: 23.11, lon: -82.37 },
  { city: "Honolulu", country: "United States", region: "North America", lat: 21.31, lon: -157.86 },
  { city: "Houston", country: "United States", region: "North America", lat: 29.76, lon: -95.37 },
  { city: "Los Angeles", country: "United States", region: "North America", lat: 34.05, lon: -118.24 },
  { city: "Mexico City", country: "Mexico", region: "North America", lat: 19.43, lon: -99.13 },
  { city: "Miami", country: "United States", region: "North America", lat: 25.76, lon: -80.19 },
  { city: "Montréal", country: "Canada", region: "North America", lat: 45.5, lon: -73.57 },
  { city: "New York", country: "United States", region: "North America", lat: 40.71, lon: -74.01 },
  { city: "Panama City", country: "Panama", region: "North America", lat: 8.98, lon: -79.52 },
  { city: "Portland", country: "United States", region: "North America", lat: 45.52, lon: -122.68 },
  { city: "San Diego", country: "United States", region: "North America", lat: 32.72, lon: -117.16 },
  { city: "San Francisco", country: "United States", region: "North America", lat: 37.77, lon: -122.42 },
  { city: "San José", country: "Costa Rica", region: "North America", lat: 9.93, lon: -84.08 },
  { city: "Seattle", country: "United States", region: "North America", lat: 47.61, lon: -122.33 },
  { city: "Toronto", country: "Canada", region: "North America", lat: 43.65, lon: -79.38 },
  { city: "Vancouver", country: "Canada", region: "North America", lat: 49.28, lon: -123.12 },
  { city: "Washington, D.C.", country: "United States", region: "North America", lat: 38.91, lon: -77.04 },
  { city: "Adelaide", country: "Australia", region: "Oceania", lat: -34.93, lon: 138.6 },
  { city: "Auckland", country: "New Zealand", region: "Oceania", lat: -36.85, lon: 174.76 },
  { city: "Brisbane", country: "Australia", region: "Oceania", lat: -27.47, lon: 153.03 },
  { city: "Melbourne", country: "Australia", region: "Oceania", lat: -37.81, lon: 144.96 },
  { city: "Perth", country: "Australia", region: "Oceania", lat: -31.95, lon: 115.86 },
  { city: "Sydney", country: "Australia", region: "Oceania", lat: -33.87, lon: 151.21 },
  { city: "Wellington", country: "New Zealand", region: "Oceania", lat: -41.29, lon: 174.78 },
  { city: "Asunción", country: "Paraguay", region: "South America", lat: -25.26, lon: -57.58 },
  { city: "Bogotá", country: "Colombia", region: "South America", lat: 4.71, lon: -74.07 },
  { city: "Buenos Aires", country: "Argentina", region: "South America", lat: -34.6, lon: -58.38 },
  { city: "Lima", country: "Peru", region: "South America", lat: -12.05, lon: -77.04 },
  { city: "Medellín", country: "Colombia", region: "South America", lat: 6.24, lon: -75.58 },
  { city: "Montevideo", country: "Uruguay", region: "South America", lat: -34.9, lon: -56.16 },
  { city: "Quito", country: "Ecuador", region: "South America", lat: -0.18, lon: -78.47 },
  { city: "Rio de Janeiro", country: "Brazil", region: "South America", lat: -22.91, lon: -43.17 },
  { city: "Santiago", country: "Chile", region: "South America", lat: -33.45, lon: -70.67 },
  { city: "São Paulo", country: "Brazil", region: "South America", lat: -23.55, lon: -46.63 },
];

export const cityValue = (city: WorldCity) => `${city.city}, ${city.country}`;


/**
 * Which of our cities is this person in?
 *
 * An offline reverse geocode against the catalog above. No third-party
 * geocoding service, which matters for three reasons: it costs nothing, it
 * never sends a member's coordinates off our infrastructure, and it does not
 * add a data processor that would have to be disclosed in the privacy policy
 * and the App Store data-collection form.
 *
 * The trade-off is resolution: this can only ever answer "nearest city we know
 * about", not a street address. That is exactly the granularity the profile
 * displays, so nothing is lost.
 *
 * Returns null when the nearest city is further than `maxKm`. That case is
 * real — plenty of people live nowhere near a major metro — and claiming a
 * city 400 km away would be worse than showing nothing.
 */
export function nearestCity(
  lat: number,
  lon: number,
  maxKm = 150,
): { city: WorldCity; distanceKm: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  let best: WorldCity | null = null;
  let bestKm = Infinity;

  for (const candidate of WORLD_CITIES) {
    const km = haversineKm(lat, lon, candidate.lat, candidate.lon);
    if (km < bestKm) {
      bestKm = km;
      best = candidate;
    }
  }

  if (!best || bestKm > maxKm) return null;
  return { city: best, distanceKm: bestKm };
}

/** Great-circle distance in km. Same formula the nearby RPC uses in SQL. */
function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** The stored `"City, Country"` label for a set of coordinates, or null. */
export function cityLabelFor(lat: number, lon: number, maxKm = 150): string | null {
  const match = nearestCity(lat, lon, maxKm);
  return match ? cityValue(match.city) : null;
}
