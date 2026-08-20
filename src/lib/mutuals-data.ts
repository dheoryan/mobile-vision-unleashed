import ironWolfArt from "@/assets/tribes/iron-wolf.webp";
import koiArt from "@/assets/tribes/koi.webp";
import studioCatArt from "@/assets/tribes/studio-cat.webp";
import nightOwlArt from "@/assets/tribes/night-owl.webp";
import honeybeeArt from "@/assets/tribes/honeybee.webp";
import ironWolfCrest from "@/assets/tribes/crests/iron-wolf.webp";
import koiCrest from "@/assets/tribes/crests/koi.webp";
import studioCatCrest from "@/assets/tribes/crests/studio-cat.webp";
import nightOwlCrest from "@/assets/tribes/crests/night-owl.webp";
import honeybeeCrest from "@/assets/tribes/crests/honeybee.webp";

export type TribeId = "wolf" | "koi" | "cat" | "owl" | "bee";

export interface Tribe {
  id: TribeId;
  name: string;
  scene: string;
  art: string;
  crest: string;
  motto: string;
  about: string;
  inside: readonly [string, string, string];
  bestFor: string;
  colorVar: string;
}

export const TRIBES: Tribe[] = [
  { id: "wolf", name: "Iron Wolf", scene: "Sports & Healthy Lifestyle", art: ironWolfArt, crest: ironWolfCrest, motto: "Move together. Grow stronger.", about: "A high-energy home for people who build friendship through movement, consistency, and showing up for one another.", inside: ["Local runs and training", "Recovery and healthy habits", "Activity partners"], bestFor: "People who would rather connect while doing than sit through small talk.", colorVar: "var(--tribe-wolf)" },
  { id: "koi", name: "Mindful Koi", scene: "Books & Thoughtful Hobbies", art: koiArt, crest: koiCrest, motto: "Follow curiosity slowly.", about: "A quieter current for readers, collectors, learners, and people who enjoy thoughtful conversations without rushing them.", inside: ["Book and film circles", "Slow hobbies and learning", "Café conversations"], bestFor: "Curious minds who prefer depth, reflection, and low-pressure connection.", colorVar: "var(--tribe-koi)" },
  { id: "cat", name: "Studio Cat", scene: "Music & Arts", art: studioCatArt, crest: studioCatCrest, motto: "Make something worth sharing.", about: "A creative room for artists, musicians, designers, and enthusiastic beginners to exchange work, ideas, and invitations.", inside: ["Open mics and exhibitions", "Works in progress", "Creative collaborators"], bestFor: "People energized by expression, experimentation, and making things together.", colorVar: "var(--tribe-cat)" },
  { id: "owl", name: "Night Owl", scene: "Nightlife & Late-Night Talks", art: nightOwlArt, crest: nightOwlCrest, motto: "The city changes after dark.", about: "An after-hours circle for spontaneous plans, hidden venues, and conversations that become more honest when the day winds down.", inside: ["Late food and walks", "Nightlife discoveries", "After-dark conversations"], bestFor: "People whose social energy arrives late and who enjoy plans with a little spontaneity.", colorVar: "var(--tribe-owl)" },
  { id: "bee", name: "Honeybee", scene: "Professional Workers", art: honeybeeArt, crest: honeybeeCrest, motto: "Build well. Share what works.", about: "A generous professional network where useful introductions, practical knowledge, and collaborative momentum matter more than self-promotion.", inside: ["Peer problem-solving", "Skill and idea exchange", "Collaborative ventures"], bestFor: "Builders and professionals looking for useful relationships with a human side.", colorVar: "var(--tribe-bee)" },
];

export const tribeById = (id: TribeId) => TRIBES.find(t => t.id === id)!;

export interface Person {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  tribeId: TribeId;
  city: string;
  bio: string;
  following?: boolean;
  mutuals?: number;
  plus?: boolean;
}

export const PEOPLE: Person[] = [
  { id: "u1", name: "Maya Reyes",  handle: "@mayaruns",      avatar: "🏃‍♀️", tribeId: "wolf", city: "Jakarta",       bio: "Sunrise miles around GBK. Slow coffee after.", mutuals: 4, plus: true },
  { id: "u2", name: "Diego Park",  handle: "@diegolifts",    avatar: "🏋️", tribeId: "wolf", city: "Oakland",       bio: "Strength + mobility. Always down to spot.", mutuals: 2 },
  { id: "u3", name: "Hana Ito",    handle: "@hana.reads",    avatar: "📚", tribeId: "koi",  city: "Jakarta",       bio: "Slow reader. Kemang cafe-hopper.", mutuals: 6, plus: true },
  { id: "u4", name: "Leo Marín",   handle: "@leoplays",      avatar: "🎸", tribeId: "cat",  city: "Brooklyn",      bio: "Open mics, vinyl crates, bad puns.", mutuals: 1 },
  { id: "u5", name: "Quinn Adair", handle: "@quinnafterdark",avatar: "🌙", tribeId: "owl",  city: "Lisbon",        bio: "Conversations after midnight.", mutuals: 3, plus: true },
  { id: "u6", name: "Priya Shah",  handle: "@priya.builds",  avatar: "💼", tribeId: "bee",  city: "Austin",        bio: "Indie founder. Will trade tactics for tacos.", mutuals: 2 },
  { id: "u7", name: "Noor Haddad", handle: "@noor.runs",     avatar: "🏔️", tribeId: "wolf", city: "Brooklyn",      bio: "Trail runs + bagel debriefs.", mutuals: 5 },
  { id: "u8", name: "Eli Chen",    handle: "@eli.studies",   avatar: "🍵", tribeId: "koi",  city: "Seattle",       bio: "Currently reading anything by Le Guin.", mutuals: 0 },
  { id: "u9",  name: "Sari Widodo", handle: "@sari.jkt",     avatar: "🎨", tribeId: "cat",  city: "Jakarta",       bio: "Senayan gallery hops + kopi susu.", mutuals: 3 },
  { id: "u10", name: "Bagus Pratama", handle: "@bagus.late", avatar: "🍜", tribeId: "owl",  city: "Jakarta",       bio: "Late-night nasi goreng walks in Menteng.", mutuals: 2, plus: true },
  { id: "u11", name: "Indah Sari",  handle: "@indah.builds", avatar: "💡", tribeId: "bee",  city: "Jakarta",       bio: "Indie founder, SCBD coffee tactician.", mutuals: 4 },
];

export interface Post {
  id: string;
  authorId: string;
  tribeId: TribeId;
  time: string;
  content: string;
  likes: number;
  liked?: boolean;
  replies: number;
  tag?: string;
  image?: string; // emoji placeholder
  imageUrl?: string; // attached photo (data URL or remote URL)
}

export const POSTS: Post[] = [
  { id: "p1", authorId: "u1", tribeId: "wolf", time: "12m", content: "Sunrise 10k along the Embarcadero — 4 of us showed up. Same time Thursday?", likes: 42, replies: 8, tag: "Run Club", image: "🌅" },
  { id: "p2", authorId: "u2", tribeId: "wolf", time: "1h",  content: "Coach Sam is doing a free mobility session at Hayes Park Saturday 9am. Bring a mat.", likes: 21, replies: 3 },
  { id: "p3", authorId: "u3", tribeId: "koi",  time: "30m", content: "Halfway through Piranesi. Anyone want to do a slow-read book club, two chapters a week?", likes: 67, replies: 14, tag: "Book Club" },
  { id: "p4", authorId: "u4", tribeId: "cat",  time: "2h",  content: "Open mic at The Crescent tonight — pulling together a small crew. DM me.", likes: 88, replies: 22, tag: "Tonight", image: "🎤" },
  { id: "p5", authorId: "u5", tribeId: "owl",  time: "3h",  content: "Late-night ramen + walk through Chinatown. Who's down for after 11?", likes: 54, replies: 11 },
  { id: "p6", authorId: "u6", tribeId: "bee",  time: "4h",  content: "Indie founder coffee Thursday 8am. Bring one problem you're stuck on, leave with one idea.", likes: 39, replies: 6, tag: "Coffee" },
  { id: "p7", authorId: "u7", tribeId: "wolf", time: "6h",  content: "Trail report: Marin Headlands fully clear after the rain. Going Sunday early.", likes: 31, replies: 5 },
  { id: "p8", authorId: "u3", tribeId: "koi",  time: "8h",  content: "Bookstore crawl in the Mission this weekend? Mapping a route.", likes: 24, replies: 7 },
];

export const personById = (id: string) => PEOPLE.find(p => p.id === id)!;

/* Group chat */
export interface ChatMsg { id: string; userId: string | "me"; text: string; time: string; }
export const CHAT_BY_TRIBE: Record<TribeId, ChatMsg[]> = {
  wolf: [
    { id: "c1", userId: "u1", text: "Anyone joining sunrise run tomorrow?", time: "7:42" },
    { id: "c2", userId: "u7", text: "I'm in. Bagels after at Wise Sons?", time: "7:43" },
    { id: "c3", userId: "me", text: "Down. I'll bring an extra layer for whoever forgot.", time: "7:45" },
    { id: "c4", userId: "u2", text: "Bringing a friend visiting from PDX 🙏", time: "7:51" },
  ],
  koi: [
    { id: "c1", userId: "u3", text: "Voted: Piranesi. Two chapters a week.", time: "9:10" },
    { id: "c2", userId: "u8", text: "Yes. Sundays?", time: "9:12" },
    { id: "c3", userId: "me", text: "Sundays work for me.", time: "9:18" },
  ],
  cat: [
    { id: "c1", userId: "u4", text: "Lineup posted for Friday. 4 spots left.", time: "11:02" },
    { id: "c2", userId: "me", text: "Save me one!", time: "11:05" },
  ],
  owl: [
    { id: "c1", userId: "u5", text: "Ramen at Marufuku — 11:30. Walk after.", time: "22:10" },
    { id: "c2", userId: "me", text: "On my way.", time: "22:14" },
  ],
  bee: [
    { id: "c1", userId: "u6", text: "Coffee Thursday 8am. Sightglass SoMa.", time: "08:30" },
    { id: "c2", userId: "me", text: "Bringing a pricing question 😅", time: "08:40" },
  ],
};

/* DMs */
export interface DMThread {
  id: string;
  withUserId: string;
  preview: string;
  time: string;
  unread?: boolean;
  messages: { id: string; from: "me" | "them"; text: string; time: string }[];
}

export const DMS: DMThread[] = [
  {
    id: "d1", withUserId: "u3", preview: "Sunday 4pm at Réveille works!", time: "10m", unread: true,
    messages: [
      { id: "m1", from: "them", text: "Hey! Saw your Hello on the book club venture 📚", time: "9:51" },
      { id: "m2", from: "me",   text: "Yes! I'd love to join. Where are you meeting?", time: "9:55" },
      { id: "m3", from: "them", text: "Sunday 4pm at Réveille works!", time: "9:58" },
    ],
  },
  {
    id: "d2", withUserId: "u1", preview: "Cool — see you Thursday 6:30!", time: "1h",
    messages: [
      { id: "m1", from: "me",   text: "Joining the Thursday run if there's space.", time: "8:10" },
      { id: "m2", from: "them", text: "Cool — see you Thursday 6:30!", time: "8:12" },
    ],
  },
  {
    id: "d3", withUserId: "u4", preview: "Hello from Studio Cat 🎵 — open mic Friday?", time: "3h",
    messages: [
      { id: "m1", from: "them", text: "Hello from Studio Cat 🎵 — open mic Friday?", time: "20:30" },
    ],
  },
];

/* Ventures */
/**
 * What a Venture is, as a set of tags the host picks (max 5).
 *
 * Grouped rather than flat. Twelve chips could sit in one row-wrapped block;
 * forty cannot — unlabelled, it becomes a wall the host skims and gives up on,
 * and they settle for whichever tag they saw first rather than the one that
 * describes their plan. The headings let someone jump to the right
 * neighbourhood and read six options instead of forty.
 *
 * Grouped by KIND OF ACTIVITY, deliberately not by Tribe. Tribe-grouping would
 * imply a Night Owl shouldn't host a hike, and cross-Tribe Ventures are the
 * main way people meet outside their own room — the last thing to discourage.
 *
 * These are free text in the database (no enum, no check constraint), so this
 * list can grow without a migration. Keep labels short: they render as chips
 * on cards where horizontal space is scarce.
 */
export const INTENT_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "Food & drink",
    items: ["Coffee", "Brunch", "Dinner", "Street Food", "Drinks", "Wine", "Dessert"],
  },
  {
    label: "Move",
    items: [
      "Run Club", "Hiking", "Bouldering", "Gym Session", "Yoga", "Pilates",
      "Cycling", "Swim", "Pickup Game", "Tennis", "Padel", "Martial Arts",
    ],
  },
  {
    label: "Make",
    items: [
      "Live Music", "Open Mic", "Jam Session", "Photo Walk", "Sketch Session",
      "Craft Workshop", "Gallery Walk",
    ],
  },
  {
    label: "Learn & play",
    items: [
      "Book Club", "Film Club", "Board Games", "Study Session", "Museum",
      "Language Exchange", "Trivia",
    ],
  },
  {
    label: "Go out",
    items: ["Night Out", "Karaoke", "Rooftop", "Club Night", "Late-night Walk", "Market"],
  },
  {
    label: "Work",
    items: ["Co-working", "Networking", "Skill Swap", "Portfolio Review", "Startup Talk"],
  },
];

/** Flat list, for anything that just needs every valid tag. */
export const INTENTS = INTENT_GROUPS.flatMap((group) => group.items);
