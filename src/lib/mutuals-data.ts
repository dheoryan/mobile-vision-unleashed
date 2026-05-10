export type TribeId = "wolf" | "koi" | "cat" | "owl" | "bee";

export interface Tribe {
  id: TribeId;
  name: string;
  emoji: string;
  scene: string;
  colorVar: string;
  members: number;
  online: number;
}

export const TRIBES: Tribe[] = [
  { id: "wolf", name: "Iron Wolf", emoji: "🐺", scene: "Sports & Healthy Lifestyle", colorVar: "var(--tribe-wolf)", members: 12480, online: 312 },
  { id: "koi",  name: "Koi",       emoji: "🐟", scene: "Books & Thoughtful Hobbies", colorVar: "var(--tribe-koi)",  members: 8210,  online: 184 },
  { id: "cat",  name: "Studio Cat",emoji: "🎵", scene: "Music & Arts",               colorVar: "var(--tribe-cat)",  members: 15640, online: 521 },
  { id: "owl",  name: "Night Owl", emoji: "🦉", scene: "Nightlife & Late-Night Talks",colorVar: "var(--tribe-owl)", members: 9970,  online: 402 },
  { id: "bee",  name: "Honeybee",  emoji: "🐝", scene: "Professional Workers",       colorVar: "var(--tribe-bee)",  members: 11230, online: 276 },
];

export interface Post {
  id: string;
  tribeId: TribeId;
  author: string;
  handle: string;
  avatar: string;
  time: string;
  content: string;
  likes: number;
  replies: number;
  tag?: string;
}

export const POSTS: Post[] = [
  { id: "p1", tribeId: "wolf", author: "Maya R.", handle: "@mayaruns", avatar: "🏃‍♀️", time: "12m", content: "Sunrise 10k along the river — 4 of us showed up. Same time Thursday?", likes: 42, replies: 8, tag: "Run Club" },
  { id: "p2", tribeId: "wolf", author: "Diego",   handle: "@diegolifts", avatar: "🏋️", time: "1h", content: "Coach Sam is doing a free mobility session at Hayes Park Saturday 9am.", likes: 21, replies: 3 },
  { id: "p3", tribeId: "koi",  author: "Hana",    handle: "@hana.reads", avatar: "📚", time: "30m", content: "Halfway through 'Piranesi'. Anyone want to do a slow-read book club?", likes: 67, replies: 14, tag: "Book Club" },
  { id: "p4", tribeId: "cat",  author: "Leo",     handle: "@leoplays",  avatar: "🎸", time: "2h", content: "Open mic at The Crescent tonight — pulling together a small crew. DM me.", likes: 88, replies: 22, tag: "Tonight" },
  { id: "p5", tribeId: "owl",  author: "Quinn",   handle: "@quinnafterdark", avatar: "🌙", time: "3h", content: "Late-night ramen + walk through Chinatown. Who's down for after 11?", likes: 54, replies: 11 },
  { id: "p6", tribeId: "bee",  author: "Priya",   handle: "@priya.builds", avatar: "💼", time: "4h", content: "Indie founder coffee Thursday 8am. Bring one problem you're stuck on.", likes: 39, replies: 6, tag: "Coffee" },
];

export interface Venture {
  id: string;
  title: string;
  host: string;
  hostAvatar: string;
  tribeId: TribeId;
  when: string;
  where: string;
  spots: number;
  taken: number;
  vibe: string;
}

export const VENTURES: Venture[] = [
  { id: "v1", title: "Sunset trail run",      host: "Maya R.",  hostAvatar: "🏃‍♀️", tribeId: "wolf", when: "Thu · 6:30pm", where: "Presidio Loop",     spots: 6, taken: 4, vibe: "Easy pace, chatty" },
  { id: "v2", title: "Slow-read book night",  host: "Hana",     hostAvatar: "📚", tribeId: "koi",  when: "Sun · 4:00pm", where: "Cafe Réveille",     spots: 5, taken: 2, vibe: "Quiet, cozy" },
  { id: "v3", title: "Open mic + late drinks",host: "Leo",      hostAvatar: "🎸", tribeId: "cat",  when: "Tonight · 9pm",where: "The Crescent",      spots: 8, taken: 6, vibe: "Loud, fun" },
  { id: "v4", title: "Midnight ramen walk",   host: "Quinn",    hostAvatar: "🌙", tribeId: "owl",  when: "Fri · 11:30pm",where: "Chinatown gate",    spots: 4, taken: 3, vibe: "Slow, wandering" },
  { id: "v5", title: "Founder coffee",        host: "Priya",    hostAvatar: "💼", tribeId: "bee",  when: "Thu · 8:00am", where: "Sightglass SoMa",   spots: 6, taken: 3, vibe: "Honest, focused" },
];

export const tribeById = (id: TribeId) => TRIBES.find(t => t.id === id)!;
