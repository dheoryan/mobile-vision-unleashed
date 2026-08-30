import type { TribeId } from "@/lib/mutuals-data";
import { planTimeLabel, type PlanPeriod } from "./venture-time.ts";

export type TribeRoomKind = "pulse_answer" | "plan" | "venture";
export type TribeRoomReaction =
  | "spark"
  | "interested"
  | "heart"
  | "laugh"
  | "wow"
  | "sad"
  | "like"
  | "support"
  | "time_1"
  | "time_2"
  | "time_3";

export const emptyTribeRoomReactions = (): Record<TribeRoomReaction, number> => ({
  spark: 0,
  interested: 0,
  heart: 0,
  laugh: 0,
  wow: 0,
  sad: 0,
  like: 0,
  support: 0,
  time_1: 0,
  time_2: 0,
  time_3: 0,
});
export type TribeRoomMetadataValue =
  | string
  | number
  | boolean
  | null
  | TribeRoomMetadata
  | TribeRoomMetadataValue[];
export interface TribeRoomMetadata {
  [key: string]: TribeRoomMetadataValue;
}

export interface TribeRoomAuthor {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
}

export interface TribeRoomItem {
  id: string;
  tribe_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  reply_to_id: string | null;
  room_kind: TribeRoomKind;
  room_metadata: TribeRoomMetadata;
  author: TribeRoomAuthor | null;
  reactions: Record<TribeRoomReaction, number>;
  my_reactions: TribeRoomReaction[];
}

export interface TribeVentureDraft {
  sourceMessageId: string;
  dbTribeId: string;
  tribeId: TribeId;
  title: string;
  note: string;
  whenLabel: string;
  timeOptions: TribePlanTimeOptionWithVotes[];
  area: string;
  maxSlots: number;
}

export type TribePlanTimeKey = "time_1" | "time_2" | "time_3";

export interface TribePlanTimeOption {
  key: TribePlanTimeKey;
  day: string;
  period: PlanPeriod;
}

export interface TribePlanTimeOptionWithVotes extends TribePlanTimeOption {
  label: string;
  votes: number;
}

export function interestedInviteIds(
  interestedUserIds: string[],
  existingApplicantIds: Iterable<string>,
  hostId: string,
): string[] {
  const existing = new Set(existingApplicantIds);
  return [...new Set(interestedUserIds)].filter(
    (userId) => userId !== hostId && !existing.has(userId),
  );
}

interface PulsePrompt {
  key: string;
  question: string;
  hint: string;
}

/**
 * Each tribe owns its own bank instead of drawing from a shared pool - a
 * question that fits Iron Wolf's training culture rarely fits Honeybee's
 * coworking one, and a shared fallback list was quietly the reason two
 * unrelated tribes could see the identical prompt on the same day.
 *
 * Grounded in real Indonesian urban social patterns (CFD Sudirman, gowes,
 * GBK, warkop, UMKM, pasar malam) rather than generic prompts in translation,
 * since that's who is actually opening this room.
 */
const TRIBE_PROMPTS: Record<TribeId, PulsePrompt[]> = {
  wolf: [
    {
      key: "wolf-lari-pagi",
      question: "What would get you up for a sunrise run this week?",
      hint: "GBK loops, a quiet neighborhood route, or just five easy kilometers.",
    },
    {
      key: "wolf-cfd-sudirman",
      question: "Car Free Day or in bed — which one wins this Sunday?",
      hint: "No wrong answer. Just be honest about which one you'll actually do.",
    },
    {
      key: "wolf-padel-trend",
      question: "Would you try padel if someone else booked the court?",
      hint: "It's everywhere right now. Zero experience required to say yes.",
    },
    {
      key: "wolf-bike-to-work",
      question: "Could you turn one commute this week into a ride instead?",
      hint: "Doesn't have to be every day. One is enough to start.",
    },
    {
      key: "wolf-gunung-weekend",
      question: "If a hike happened this weekend, which mountain makes the list?",
      hint: "Bromo, Papandayan, Gede — or somewhere closer that counts too.",
    },
    {
      key: "wolf-futsal-crew",
      question: "Is your futsal squad still active, or does it need reviving?",
      hint: "Name the people who'd actually show up on a Tuesday night.",
    },
    {
      key: "wolf-rest-day-guilt",
      question: "Do you actually take rest days, or just feel guilty about them?",
      hint: "No shame either way — just curious what the room does.",
    },
    {
      key: "wolf-badminton-court",
      question: "GOR badminton or gym — what's winning this week?",
      hint: "Indonesia's actual national sport deserves a vote.",
    },
    {
      key: "wolf-gym-playlist",
      question: "What's the one song that gets you through the last set?",
      hint: "Drop it. The room is building a shared gym playlist.",
    },
    {
      key: "wolf-strava-flex",
      question: "Be honest — do you check Strava kudos more than you'd admit?",
      hint: "No judgment. Tracking apps made this a group sport too.",
    },
    {
      key: "wolf-new-sport-try",
      question: "What sport have you always wanted to try but never booked?",
      hint: "Muay Thai, climbing, swimming — name the one holding you back.",
    },
    {
      key: "wolf-mager-fight",
      question: "What's your actual trick for beating a mager Monday?",
      hint: "The room needs better excuses to move than 'just do it.'",
    },
    {
      key: "wolf-jalan-sehat",
      question: "Would you rather train hard or just jalan santai this week?",
      hint: "Both count as showing up. Pick your mood.",
    },
    {
      key: "wolf-injury-comeback",
      question: "Coming back from an injury or a long break — what's the plan?",
      hint: "Slow and honest beats fast and reckless. Tell the room your pace.",
    },
    {
      key: "wolf-hydration-check",
      question: "What's your actual excuse for not drinking enough water?",
      hint: "Everyone has one. The room collects the best ones.",
    },
    {
      key: "wolf-sunday-swim",
      question: "Kolam renang Sunday — who's actually going?",
      hint: "Public pool, hotel pool, or the sea if you're lucky enough.",
    },
    {
      key: "wolf-accountability-buddy",
      question: "Who keeps you accountable when you want to skip a workout?",
      hint: "Name them, or admit the room might need to be that person.",
    },
    {
      key: "wolf-gear-upgrade",
      question: "What piece of gear would actually change your training?",
      hint: "Shoes, a mat, a proper bag — the boring stuff that matters.",
    },
    {
      key: "wolf-weekend-adventure",
      question: "What's one physical thing you want off your plate before Monday?",
      hint: "A long walk, a hike, a swim — anything that isn't sitting.",
    },
    {
      key: "wolf-muaythai-curious",
      question: "Would you show up to a Muay Thai class with zero experience?",
      hint: "Everyone in that gym started exactly there too.",
    },
    {
      key: "wolf-recovery-ritual",
      question: "What's your actual recovery ritual, or do you just wing it?",
      hint: "Stretching, sauna, sleep — or nothing, and that's fine to admit.",
    },
    {
      key: "wolf-streak-check",
      question: "How many days in a row have you actually moved your body?",
      hint: "Be honest. One counts. Zero is a fine place to restart from.",
    },
    {
      key: "wolf-teammate-search",
      question: "What sport are you missing a teammate for right now?",
      hint: "Tennis, badminton, climbing — the room might just have one.",
    },
    {
      key: "wolf-morning-vs-night",
      question: "Morning workout or night workout — no in-between?",
      hint: "Pick a side. The room is quietly judging either way.",
    },
    {
      key: "wolf-sore-legs",
      question: "What did you do that left you sore in the best way this week?",
      hint: "Leg day, a long hike, a hard match — brag a little.",
    },
    {
      key: "wolf-cycling-route",
      question: "What's the best gowes route near you nobody talks about?",
      hint: "A quiet street, a park loop, a river path — share the secret.",
    },
    {
      key: "wolf-sports-comeback",
      question: "What sport did you quit as a kid that you'd try again now?",
      hint: "No pressure to be good. Just curious what calls you back.",
    },
    {
      key: "wolf-weekend-warrior",
      question: "Weekend warrior or steady all week — which one is actually you?",
      hint: "Both work. The room wants to know which camp you're in.",
    },
    {
      key: "wolf-spar-partner",
      question: "Would you spar, climb, or run with a total stranger from here?",
      hint: "That's kind of the whole point of this room existing.",
    },
    {
      key: "wolf-training-plateau",
      question: "What's the plateau you can't seem to break through right now?",
      hint: "Name it. Someone here has probably hit the same wall.",
    },
    {
      key: "wolf-sunrise-vs-sunset",
      question: "Sunrise training or golden hour training — pick one.",
      hint: "Both are objectively good lighting for a story.",
    },
    {
      key: "wolf-cheat-meal",
      question: "What's the meal you actually earned this week?",
      hint: "No guilt. Training hard buys you something good to eat.",
    },
    {
      key: "wolf-sport-doc",
      question: "What sports documentary or match got you hyped recently?",
      hint: "Local league, international final, or a random YouTube find.",
    },
    {
      key: "wolf-climb-first-time",
      question: "Would you try indoor climbing for the first time this week?",
      hint: "Everyone falls off the wall the first few tries. That's the sport.",
    },
    {
      key: "wolf-long-weekend-plan",
      question: "Got a long weekend coming — active plan or full rest?",
      hint: "Either is a legitimate use of a day off.",
    },
    {
      key: "wolf-group-run-fear",
      question: "What's stopping you from joining a group run you've seen posted?",
      hint: "Pace anxiety is universal. Name it and someone will relate.",
    },
    {
      key: "wolf-sport-injury-story",
      question: "What's your best 'how I actually got this injury' story?",
      hint: "The dumber the story, the better it usually is.",
    },
    {
      key: "wolf-new-year-goal-check",
      question: "How's the fitness goal from January actually holding up?",
      hint: "No judgment. Just an honest mid-year check-in.",
    },
    {
      key: "wolf-sport-friendship",
      question: "Who's a friend you only really see through sport?",
      hint: "Those bonds count even if you never hang out otherwise.",
    },
    {
      key: "wolf-move-together-plan",
      question: "If this room did one active thing together this month, what should it be?",
      hint: "Say the plan. Someone here will actually organize it.",
    },
  ],
  koi: [
    {
      key: "koi-current-read",
      question: "What are you actually reading right now, no lying?",
      hint: "Half-finished counts. So does a book you reread for comfort.",
    },
    {
      key: "koi-cafe-corner",
      question: "What's your go-to café corner for getting lost in a book?",
      hint: "Kemang, a Kopi Kenangan wherever, or your own kitchen table.",
    },
    {
      key: "koi-slow-hobby",
      question: "What slow hobby have you been meaning to actually start?",
      hint: "Journaling, calligraphy, knitting — the one you keep postponing.",
    },
    {
      key: "koi-book-club",
      question: "Would you join a two-chapters-a-week book club if it existed?",
      hint: "Low pressure. Nobody's tested on it.",
    },
    {
      key: "koi-thrift-find",
      question: "What's the best thing you've found thrifting or at a book sale?",
      hint: "A book, a record, a weird little object — show it off.",
    },
    {
      key: "koi-museum-visit",
      question: "When did you last actually go to a museum or gallery?",
      hint: "MACAN, a small local exhibit, or somewhere you stumbled into.",
    },
    {
      key: "koi-journal-honest",
      question: "What's one honest line from your journal you'd actually share?",
      hint: "Just one. The room isn't asking for the whole page.",
    },
    {
      key: "koi-comfort-reread",
      question: "What book do you reread instead of finishing something new?",
      hint: "No shame — comfort reading is still reading.",
    },
    {
      key: "koi-bookstore-crawl",
      question: "What's your favorite indie bookstore nobody talks about enough?",
      hint: "The tiny ones tucked away always have the best finds.",
    },
    {
      key: "koi-vinyl-find",
      question: "What record or album have you been meaning to actually sit and listen to?",
      hint: "Front to back, no skipping — when's that happening?",
    },
    {
      key: "koi-slow-sunday",
      question: "What does an actual slow Sunday look like for you?",
      hint: "No obligations. Just the version you'd pick if nobody was watching.",
    },
    {
      key: "koi-quote-share",
      question: "What's a line from something you read recently that stuck?",
      hint: "Book, article, song lyric — anything that lodged itself in your head.",
    },
    {
      key: "koi-hobby-abandoned",
      question: "What hobby did you quietly abandon that you actually miss?",
      hint: "It's allowed to just sit there unfinished. No pressure to restart.",
    },
    {
      key: "koi-tea-vs-coffee",
      question: "Tea person or coffee person while reading — pick a side.",
      hint: "The room is building an unnecessary but important database.",
    },
    {
      key: "koi-genre-defense",
      question: "What genre do you secretly judge people for, but actually love?",
      hint: "Romance, fantasy, self-help — defend it a little.",
    },
    {
      key: "koi-writing-someday",
      question: "Is there something you'd actually want to write someday?",
      hint: "A book, a blog, just letters to yourself. Say the idea out loud.",
    },
    {
      key: "koi-film-adaptation",
      question: "Book or the film adaptation — which one actually got it right?",
      hint: "Everyone has a strong, slightly unhinged opinion here.",
    },
    {
      key: "koi-museum-companion",
      question: "Who would you actually want to wander a museum with in silence?",
      hint: "Not everyone can do quiet browsing together. Name who can.",
    },
    {
      key: "koi-desk-setup",
      question: "What does your actual reading or writing corner look like right now?",
      hint: "Messy is allowed. The room isn't judging the pile of mugs.",
    },
    {
      key: "koi-podcast-swap",
      question: "What podcast episode do you keep meaning to recommend?",
      hint: "The one you've mentioned to three people already.",
    },
    {
      key: "koi-library-card",
      question: "When did you last actually use a library instead of buying?",
      hint: "No wrong answer. Some of us forgot libraries exist.",
    },
    {
      key: "koi-slow-craft",
      question: "What could you make with your hands if you gave it a rainy afternoon?",
      hint: "Sketching, embroidery, a puzzle — anything unhurried.",
    },
    {
      key: "koi-book-swap",
      question: "Got a book you'd actually trade with someone in this room?",
      hint: "Say the title. Someone might take you up on it.",
    },
    {
      key: "koi-overthinking",
      question: "What have you been quietly overthinking this week?",
      hint: "Small stuff counts. This room is a decent place to say it out loud.",
    },
    {
      key: "koi-handwriting",
      question: "Do you still write anything by hand, or has it all gone digital?",
      hint: "A list, a letter, a journal entry — anything with actual ink.",
    },
    {
      key: "koi-cafe-hop",
      question: "What's the café you'd take a first-time visitor to?",
      hint: "Not the trendiest one — the one you'd actually pick.",
    },
    {
      key: "koi-book-hoarding",
      question: "How many unread books are quietly stacking up right now?",
      hint: "Be honest. The room will not judge the tsundoku pile.",
    },
    {
      key: "koi-conversation-topic",
      question: "What topic could you talk about for an hour with the right person?",
      hint: "Niche is good. That's exactly what this room is for.",
    },
    {
      key: "koi-rainy-day-plan",
      question: "What's the actual plan for the next properly rainy day?",
      hint: "A book, a film, a nap — nothing that requires leaving the house.",
    },
    {
      key: "koi-secondhand-book",
      question: "What's the best secondhand book you've ever picked up?",
      hint: "Bonus points if it had someone else's notes in the margins.",
    },
    {
      key: "koi-learning-slow",
      question: "What are you slowly teaching yourself with no deadline at all?",
      hint: "A language, an instrument, a skill — however far along you are.",
    },
    {
      key: "koi-favorite-author",
      question: "Which author would you want to just sit and listen to talk?",
      hint: "Doesn't have to be your favorite book — just the best talker.",
    },
    {
      key: "koi-notebook-type",
      question: "What kind of notebook person are you?",
      hint: "Dotted grid, plain, whatever's cheapest — reveal your type.",
    },
    {
      key: "koi-museum-exhibit-wish",
      question: "What exhibit would you actually want to see come to Jakarta?",
      hint: "Dream big. Someone in the room might know how to make it happen.",
    },
    {
      key: "koi-book-vs-scroll",
      question: "Real talk — book before bed, or one more scroll?",
      hint: "The room already knows the honest answer for most of us.",
    },
    {
      key: "koi-collection",
      question: "What's the small, slightly odd collection you keep adding to?",
      hint: "Postcards, stamps, secondhand mugs — show the room your thing.",
    },
    {
      key: "koi-cafe-solo",
      question: "Do you actually enjoy sitting at a café alone, or does it feel weird?",
      hint: "Both answers are completely normal. Just curious where you land.",
    },
    {
      key: "koi-book-recommend",
      question: "What book would you hand someone without knowing much about them?",
      hint: "The safe universal pick. Everyone has one.",
    },
    {
      key: "koi-slow-week-plan",
      question: "What would make this week feel slower in a good way?",
      hint: "One small thing you could actually protect on the calendar.",
    },
    {
      key: "koi-shared-read",
      question: "Want to try reading the same thing as someone else in the room this month?",
      hint: "Say the title. Somebody might actually match with you.",
    },
  ],
  cat: [
    {
      key: "cat-current-project",
      question: "What's the thing you're actually making right now?",
      hint: "Song, sketch, edit, half-finished draft — all of it counts.",
    },
    {
      key: "cat-open-mic",
      question: "Would you actually get up at an open mic, or just watch?",
      hint: "No pressure to perform. Just be honest about which one you are.",
    },
    {
      key: "cat-gig-this-week",
      question: "Any gigs, pameran, or shows worth catching this week?",
      hint: "Drop it here. The room needs an excuse to leave the house.",
    },
    {
      key: "cat-collab-wanted",
      question: "What kind of collaborator are you actually missing right now?",
      hint: "A vocalist, a photographer, someone to bounce ideas off — name it.",
    },
    {
      key: "cat-mural-spot",
      question: "What's the best mural or street art you've walked past lately?",
      hint: "Kota Tua, a random gang, wherever — send the room hunting.",
    },
    {
      key: "cat-vinyl-night",
      question: "Would you show up to a vinyl or DJ night with strangers?",
      hint: "Bring nothing but curiosity. That's the whole entry requirement.",
    },
    {
      key: "cat-unfinished-work",
      question: "What's the unfinished piece sitting in your folder right now?",
      hint: "Nobody's asking you to finish it today. Just name it.",
    },
    {
      key: "cat-karaoke-pick",
      question: "What's your actual go-to karaoke song, no judgment?",
      hint: "The room already assumes it's slightly embarrassing. Say it anyway.",
    },
    {
      key: "cat-inspo-source",
      question: "Where's your creative inspiration actually coming from this week?",
      hint: "A song, a feed, a conversation — trace it back.",
    },
    {
      key: "cat-craft-workshop",
      question: "What craft workshop would you actually sign up for?",
      hint: "Pottery, batik, a photography class — pick the one that sounds fun, not useful.",
    },
    {
      key: "cat-first-instrument",
      question: "What instrument did you almost learn but never picked up?",
      hint: "It's not too late. The room just wants to know which one.",
    },
    {
      key: "cat-photo-walk",
      question: "Would you join a photo hunt around Kota Tua or somewhere similar?",
      hint: "Phone camera counts. This isn't about equipment.",
    },
    {
      key: "cat-song-stuck",
      question: "What song has been stuck in your head for no reason this week?",
      hint: "Doesn't have to be good. Just honest.",
    },
    {
      key: "cat-art-block",
      question: "What's actually causing your creative block right now?",
      hint: "Name it plainly. Sometimes that's most of the fix.",
    },
    {
      key: "cat-fan-art",
      question: "What's something you've made fan art or a cover of?",
      hint: "A show, a song, a game — the room won't judge the fandom.",
    },
    {
      key: "cat-exhibit-visit",
      question: "What local exhibition or pameran deserves more attention?",
      hint: "Small gallery, student show, pop-up — hype it up here.",
    },
    {
      key: "cat-practice-honesty",
      question: "Did you actually practice this week, or just think about it?",
      hint: "Zero judgment either way. Just an honest check-in.",
    },
    {
      key: "cat-cover-song",
      question: "What song would you actually attempt to cover if pushed to?",
      hint: "Badly is fine. This room has heard worse.",
    },
    {
      key: "cat-studio-setup",
      question: "What does your actual creative corner look like right now?",
      hint: "Messy desk, one plug-in, a stolen bedroom corner — show it.",
    },
    {
      key: "cat-first-gig-memory",
      question: "What's your first real memory of a gig or performance?",
      hint: "As a performer or just someone in the crowd — either counts.",
    },
    {
      key: "cat-genre-mashup",
      question: "What two genres would you smash together if nobody stopped you?",
      hint: "The weirder the combo, the more the room wants to hear it.",
    },
    {
      key: "cat-crowd-vs-solo",
      question: "Do you create better with people around, or completely alone?",
      hint: "Both are valid working styles. Pick your honest one.",
    },
    {
      key: "cat-street-performer",
      question: "Ever stopped for a street performer and actually stayed?",
      hint: "What made you stop instead of just walking past?",
    },
    {
      key: "cat-diy-instrument",
      question: "What's the most makeshift instrument you've ever used?",
      hint: "Pots, a desk, your own voice — resourcefulness counts.",
    },
    {
      key: "cat-art-supply-hoard",
      question: "What art or music supply have you bought and barely touched?",
      hint: "The room collects guilty little purchases too.",
    },
    {
      key: "cat-tiktok-trend",
      question: "What creative trend online have you actually tried recreating?",
      hint: "A dance, an audio, an edit style — own up to it.",
    },
    {
      key: "cat-dream-collab",
      question: "If you could collaborate with anyone, dead or alive, who's the pick?",
      hint: "Musician, artist, writer — dream a little wild here.",
    },
    {
      key: "cat-open-studio",
      question: "Would you let people watch you work in progress, mess and all?",
      hint: "Open studios are basically vulnerability with good lighting.",
    },
    {
      key: "cat-batik-curious",
      question: "Ever actually tried batik or a traditional craft yourself?",
      hint: "Not just bought it — actually made something with your hands.",
    },
    {
      key: "cat-song-that-heals",
      question: "What song do you put on when you need to reset?",
      hint: "Share it. Someone here probably needs it this week too.",
    },
    {
      key: "cat-crit-fear",
      question: "What's stopping you from sharing something you made?",
      hint: "Fear of critique is universal. Name it and it gets smaller.",
    },
    {
      key: "cat-live-vs-recorded",
      question: "Live performance or a polished recording — which hits harder for you?",
      hint: "Both are valid. The room just wants your honest lean.",
    },
    {
      key: "cat-childhood-art",
      question: "What did you love making as a kid that you've since dropped?",
      hint: "Drawing, dance, music — worth a second look now?",
    },
    {
      key: "cat-busking-tip",
      question: "Ever busked, or tipped a busker who genuinely earned it?",
      hint: "Either side of that moment counts as a story.",
    },
    {
      key: "cat-color-mood",
      question: "What color has been showing up in everything you're making lately?",
      hint: "Sometimes a mood picks the palette before you notice.",
    },
    {
      key: "cat-remix-idea",
      question: "What existing song or piece would you remix if you had the rights?",
      hint: "Pure fantasy exercise. Go wild with the pick.",
    },
    {
      key: "cat-gallery-wall",
      question: "If you had one wall to fill with art, what goes on it?",
      hint: "Yours, someone else's, or a mix — describe the wall.",
    },
    {
      key: "cat-perform-fear-flip",
      question: "What would make you finally say yes to performing in public?",
      hint: "Name the exact condition. Someone might create it.",
    },
    {
      key: "cat-sketchbook-peek",
      question: "What's on the last page of your sketchbook or notes app?",
      hint: "Half-formed ideas count more than finished ones here.",
    },
    {
      key: "cat-make-together",
      question: "What could this room actually make together this month?",
      hint: "A playlist, a group show, a zine — pitch it and see who bites.",
    },
  ],
  owl: [
    {
      key: "owl-late-craving",
      question: "What are you craving at 1am that no one else understands?",
      hint: "Indomie, sate padang gerobak, or something oddly specific.",
    },
    {
      key: "owl-rooftop-plan",
      question: "Rooftop, warkop, or your own balcony — where's tonight happening?",
      hint: "Pick the version of 'out' that actually matches your energy.",
    },
    {
      key: "owl-cant-sleep",
      question: "What's actually keeping you up tonight?",
      hint: "Overthinking, a good book, or just not being tired yet — all valid.",
    },
    {
      key: "owl-night-drive",
      question: "Would you go on an aimless night drive if someone else was driving?",
      hint: "No destination required. Just windows down and no plan.",
    },
    {
      key: "owl-24hr-spot",
      question: "What's your go-to 24-hour spot when the city's asleep?",
      hint: "A warung, a convenience store bench, wherever counts.",
    },
    {
      key: "owl-midnight-convo",
      question: "What's a conversation that only happens after midnight for you?",
      hint: "The honest ones always seem to wait until it's late.",
    },
    {
      key: "owl-karaoke-till-dawn",
      question: "Karaoke until the room kicks you out — who's actually in?",
      hint: "No singing talent required, just commitment to bad decisions.",
    },
    {
      key: "owl-night-market",
      question: "When did you last actually wander a pasar malam?",
      hint: "The smell of it alone is basically nostalgia at this point.",
    },
    {
      key: "owl-late-shift-respect",
      question: "Shoutout who's actually working the night shift tonight.",
      hint: "Security, drivers, warung owners — the city runs on them.",
    },
    {
      key: "owl-insomnia-hobby",
      question: "What do you actually do on the nights you can't sleep?",
      hint: "Doomscroll, journal, rewatch something — no wrong answer.",
    },
    {
      key: "owl-3am-thought",
      question: "What's a 3am thought you'd never say out loud at noon?",
      hint: "The night makes everything feel more honest. Use that.",
    },
    {
      key: "owl-late-night-friend",
      question: "Who's your actual 'awake at 2am, send help' friend?",
      hint: "Everyone has exactly one. Tag them in spirit.",
    },
    {
      key: "owl-night-photography",
      question: "Ever tried shooting the city after dark?",
      hint: "Neon signs, empty streets, headlights — different city entirely.",
    },
    {
      key: "owl-comfort-show",
      question: "What show do you rewatch when you should be sleeping?",
      hint: "The one you know by heart but still can't turn off.",
    },
    {
      key: "owl-late-eat-guilt",
      question: "Midnight snack — guilt-free or guilty pleasure for you?",
      hint: "The room isn't judging either camp.",
    },
    {
      key: "owl-city-after-dark",
      question: "What does your neighborhood actually feel like at midnight?",
      hint: "Quiet, alive, a little eerie — describe your specific street.",
    },
    {
      key: "owl-nightcap-drink",
      question: "Coffee, tea, or something stronger for your actual nightcap?",
      hint: "Whatever gets you through the last hour of the day.",
    },
    {
      key: "owl-late-work-session",
      question: "Are you a late-night worker, or does everything wait till morning?",
      hint: "Some brains only turn on after 10pm. Fair enough.",
    },
    {
      key: "owl-spontaneous-plan",
      question: "What's the most spontaneous thing you've done after 11pm?",
      hint: "Bonus points if you regretted it slightly the next morning.",
    },
    {
      key: "owl-podcast-fall-asleep",
      question: "What do you actually put on to fall asleep to?",
      hint: "Podcast, white noise, silence — reveal your sleep setup.",
    },
    {
      key: "owl-late-night-hunger",
      question: "Sate, mie ayam gerobak, or something you'd never admit at brunch?",
      hint: "Late-night food judgment doesn't count the same way.",
    },
    {
      key: "owl-night-owl-vs-early-bird",
      question: "Are you actually a night owl, or just avoiding your morning?",
      hint: "Be honest. The room can tell either way.",
    },
    {
      key: "owl-city-lights",
      question: "What's the best view of the city you've caught at night?",
      hint: "A rooftop, a bridge, a random parking lot — send it.",
    },
    {
      key: "owl-late-text",
      question: "What's a text you've drafted at 1am and never sent?",
      hint: "You don't have to share the words. Just admit it exists.",
    },
    {
      key: "owl-loud-vs-quiet-night",
      question: "Loud night out or quiet night in — what's actually calling you tonight?",
      hint: "No wrong answer, just an honest read of your energy.",
    },
    {
      key: "owl-late-conversation-topic",
      question: "What topic only comes up in your group chat after midnight?",
      hint: "Every group chat has one. What's yours?",
    },
    {
      key: "owl-night-run",
      question: "Would you actually go for a walk or run at night instead of morning?",
      hint: "The city hits differently when it's empty.",
    },
    {
      key: "owl-overnight-trip",
      question: "If a spontaneous overnight trip happened tonight, where to?",
      hint: "Doesn't have to be far. Just somewhere that isn't home.",
    },
    {
      key: "owl-late-movie",
      question: "Midnight movie marathon — solo or does the room get an invite?",
      hint: "Name the film. Somebody's probably already seen it forty times.",
    },
    {
      key: "owl-night-job-respect",
      question: "What's a late-night job you think doesn't get enough credit?",
      hint: "Ojol drivers, radio hosts, 24-hour pharmacy staff — name one.",
    },
    {
      key: "owl-cant-explain-mood",
      question: "What mood shows up specifically after dark for you?",
      hint: "Reflective, restless, romantic — night has its own weather.",
    },
    {
      key: "owl-warkop-order",
      question: "What's your standard warkop order, no thinking required?",
      hint: "Kopi item, snack, the whole ritual — lay it out.",
    },
    {
      key: "owl-late-plan-flake",
      question: "What late-night plan did you actually flake on this week?",
      hint: "No judgment. Sometimes 11pm energy doesn't survive to 11pm.",
    },
    {
      key: "owl-city-sounds",
      question: "What sound means 'late night' to you specifically?",
      hint: "A street vendor's call, distant traffic, your own fan — name it.",
    },
    {
      key: "owl-second-wind",
      question: "When does your actual second wind kick in?",
      hint: "9pm, midnight, 2am — everyone's clock is different.",
    },
    {
      key: "owl-honest-hour",
      question: "What's the hour you're most honest with yourself?",
      hint: "For a lot of people it's later than they'd admit.",
    },
    {
      key: "owl-late-night-plan-tonight",
      question: "If tonight had a plan, what would it actually be?",
      hint: "Say it out loud. Someone in the room might already be free.",
    },
    {
      key: "owl-24hr-city-favorite",
      question: "What never closes near you that you're quietly grateful for?",
      hint: "A warung, a laundromat, a 24-hour gym — small mercies count.",
    },
    {
      key: "owl-late-realization",
      question: "What did you realize about yourself only because it was late?",
      hint: "The good insights tend to show up after midnight.",
    },
    {
      key: "owl-group-late-hang",
      question: "Would this room actually pull off a late-night hang this month?",
      hint: "Say when. Someone's always already awake anyway.",
    },
  ],
  bee: [
    {
      key: "bee-side-hustle",
      question: "What's the side hustle you've been quietly building?",
      hint: "Doesn't have to be profitable yet. Just say what it is.",
    },
    {
      key: "bee-coworking-day",
      question: "Coworking space, café, or home desk — where's today happening?",
      hint: "Pick honestly, not aspirationally.",
    },
    {
      key: "bee-stuck-problem",
      question: "What's the one work problem you're actually stuck on right now?",
      hint: "Name it plainly. This room solves things over coffee, not LinkedIn.",
    },
    {
      key: "bee-networking-dread",
      question: "Do you actually enjoy networking events, or just tolerate them?",
      hint: "Be honest. Most people are faking it too.",
    },
    {
      key: "bee-startup-idea",
      question: "What business idea have you been sitting on but not started?",
      hint: "Half-baked is fine. Someone here might want in.",
    },
    {
      key: "bee-mentor-wanted",
      question: "What skill do you wish you had a mentor for right now?",
      hint: "Name it. The room might already have that person.",
    },
    {
      key: "bee-freelance-fear",
      question: "What's stopping you from going freelance, or was it worth it?",
      hint: "Both the scared and the already-did-it answers are useful here.",
    },
    {
      key: "bee-personal-brand",
      question:
        "Do you actually have a personal brand, or is that just a LinkedIn buzzword to you?",
      hint: "No wrong answer. Just curious where you land.",
    },
    {
      key: "bee-umkm-support",
      question: "What local UMKM or small business deserves more customers?",
      hint: "Tag it. This room can actually move the needle a little.",
    },
    {
      key: "bee-quiet-quit",
      question: "Are you quiet quitting, quietly hustling, or somewhere in between?",
      hint: "Honest self-assessment only. No judgment either way.",
    },
    {
      key: "bee-career-pivot",
      question: "What career pivot have you been thinking about but not made?",
      hint: "Say it out loud once. That's usually the hardest part.",
    },
    {
      key: "bee-best-advice",
      question: "What's the best career advice you've ever actually used?",
      hint: "Not the advice you got — the one you actually applied.",
    },
    {
      key: "bee-burnout-check",
      question: "Real talk — how close to burnout are you this week?",
      hint: "A scale, a feeling, whatever. Just an honest check-in.",
    },
    {
      key: "bee-negotiation-story",
      question: "What's a negotiation you're proud of, work or otherwise?",
      hint: "Salary, a deal, even a family argument — the skill transfers.",
    },
    {
      key: "bee-remote-vs-office",
      question: "Remote, hybrid, or fully in-office — what's actually working for you?",
      hint: "Not what your company mandates. What you'd actually pick.",
    },
    {
      key: "bee-skill-swap",
      question: "What skill would you trade with someone else in this room?",
      hint: "You teach yours, they teach theirs. Old-school barter, basically.",
    },
    {
      key: "bee-first-job-lesson",
      question: "What did your first real job teach you that still holds up?",
      hint: "Could be a skill, could be a hard lesson. Both count.",
    },
    {
      key: "bee-linkedin-cringe",
      question: "What LinkedIn post trend makes you cringe the hardest?",
      hint: "You know the format. Call it out.",
    },
    {
      key: "bee-productivity-myth",
      question: "What productivity hack do you think is actually a myth?",
      hint: "5am club, cold showers, whatever — the room wants your honest take.",
    },
    {
      key: "bee-client-story",
      question: "What's the wildest client or customer story you can actually share?",
      hint: "Names optional. The chaos is the point.",
    },
    {
      key: "bee-work-friend",
      question: "Who's the coworker or work friend you'd actually follow to a new company?",
      hint: "Those bonds are rarer than they should be. Name yours.",
    },
    {
      key: "bee-idle-idea",
      question: "What idea have you mentioned to three people but never tested?",
      hint: "This is your fourth person. Say it here.",
    },
    {
      key: "bee-money-talk",
      question: "Would you actually be comfortable talking salary with this room?",
      hint: "No pressure to answer — just curious how the room feels about it.",
    },
    {
      key: "bee-startup-alumni",
      question: "Worked at a startup that blew up or blew apart — got a story?",
      hint: "Jakarta's startup scene has no shortage of these. Share yours.",
    },
    {
      key: "bee-cowork-etiquette",
      question: "What's your biggest coworking space pet peeve?",
      hint: "Loud calls, stolen chargers, the one guy who takes every meeting room.",
    },
    {
      key: "bee-mentorship-give",
      question: "What could you actually mentor someone on right now?",
      hint: "You don't need ten years of experience. One year ahead counts.",
    },
    {
      key: "bee-work-life-line",
      question: "Where do you actually draw the line between work and everything else?",
      hint: "Or admit you haven't found one yet. That's honest too.",
    },
    {
      key: "bee-pitch-practice",
      question: "If you had to pitch your current project in one sentence, go.",
      hint: "This is free practice for whenever it actually matters.",
    },
    {
      key: "bee-industry-shift",
      question: "What's changing in your industry that nobody's talking about enough?",
      hint: "AI, remote work, new regulation — name the quiet shift.",
    },
    {
      key: "bee-collab-wanted",
      question: "What kind of collaborator or co-founder are you actually missing?",
      hint: "Technical, creative, just someone with follow-through — name it.",
    },
    {
      key: "bee-failed-venture",
      question: "What business or project of yours didn't work out?",
      hint: "The room learns more from these than the wins, honestly.",
    },
    {
      key: "bee-morning-routine-work",
      question: "What's your actual first work task of the day, no lying?",
      hint: "Email, coffee and stare, or straight into deep work — reveal it.",
    },
    {
      key: "bee-resource-share",
      question: "What tool or resource quietly changed how you work?",
      hint: "An app, a template, a habit — pass it on to the room.",
    },
    {
      key: "bee-dream-client",
      question: "Who's the dream client or company you'd want to work with?",
      hint: "Aim unreasonably high. Naming it is step one.",
    },
    {
      key: "bee-quiet-win",
      question: "What's a small work win this week nobody else noticed?",
      hint: "It doesn't need an audience to count. Say it here.",
    },
    {
      key: "bee-office-politics",
      question: "What's the most 'corporate drama' thing you've witnessed at work?",
      hint: "Keep it vague enough to stay safe, specific enough to be good.",
    },
    {
      key: "bee-founder-question",
      question: "What would you ask a local founder if you had ten minutes with them?",
      hint: "One real question. The room might actually know someone.",
    },
    {
      key: "bee-career-risk",
      question: "What's the biggest career risk you've actually taken?",
      hint: "Quitting, pivoting, starting something — how'd it turn out?",
    },
    {
      key: "bee-work-community",
      question: "Do you actually have a community around your work, or is it lonely?",
      hint: "Freelancers and founders especially — be honest about this one.",
    },
    {
      key: "bee-collab-this-month",
      question: "What could this room actually build or trade skills on this month?",
      hint: "Pitch it. Someone here has exactly the skill you're missing.",
    },
  ],
};

function localDateKey(now: Date) {
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].join("-");
}

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

function monthKey(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Deterministic seeded shuffle (mulberry32 PRNG + Fisher-Yates). Given the
 * same seed it always produces the same order, which is the whole point:
 * every member's device needs to land on the same day-by-day sequence
 * without any of them talking to a server.
 */
function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(next() * (index + 1));
    [result[index], result[swapWith]] = [result[swapWith], result[index]];
  }
  return result;
}

/**
 * One shuffle of the tribe's whole bank per calendar month, keyed by
 * `tribeId:year-month` - every day inside that month draws the next entry
 * from the shuffle, so with 40 prompts per tribe a 30-31 day month never
 * repeats one, and next month reshuffles independently rather than reusing
 * the same order. The bank only needs to be longer than the days in a month
 * for the no-repeat guarantee to hold; it doesn't need to reach 100 for that.
 */
export function dailyPulse(tribeId: TribeId, now = new Date()) {
  const bank = TRIBE_PROMPTS[tribeId];
  const month = monthKey(now);
  const order = seededShuffle(bank, hash(`${tribeId}:${month}`));
  const prompt = order[(now.getDate() - 1) % order.length];
  const date = localDateKey(now);
  return { ...prompt, id: `${date}:${tribeId}:${prompt.key}` };
}

/**
 * Consecutive days (walking backward from today) the tribe answered its
 * Tribevia, using the same deterministic prompt ids `counts` was tallied
 * against. Stops at the first missed day rather than just lowering the
 * count, so it reads as an honest "currently on N," not a lifetime total.
 */
export function pulseStreak(
  tribeId: TribeId,
  counts: Record<string, number>,
  now = new Date(),
): number {
  let streak = 0;
  for (let offset = 0; offset < 31; offset += 1) {
    const probe = new Date(now);
    probe.setDate(now.getDate() - offset);
    const prompt = dailyPulse(tribeId, probe);
    if ((counts[prompt.id] ?? 0) > 0) streak += 1;
    else break;
  }
  return streak;
}

export function roomMetadataString(metadata: TribeRoomMetadata, key: string, fallback = "") {
  const value = metadata[key];
  return typeof value === "string" ? value : fallback;
}

export function roomMetadataNumber(metadata: TribeRoomMetadata, key: string, fallback: number) {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

const TIME_KEYS: TribePlanTimeKey[] = ["time_1", "time_2", "time_3"];
const PLAN_PERIODS: PlanPeriod[] = ["morning", "afternoon", "evening"];

export function roomMetadataTimeOptions(
  metadata: TribeRoomMetadata,
  reactions: Record<TribeRoomReaction, number> = emptyTribeRoomReactions(),
): TribePlanTimeOptionWithVotes[] {
  const value = metadata.time_options;
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const key = entry.key;
    const day = entry.day;
    const period = entry.period;
    if (
      index > 2 ||
      typeof key !== "string" ||
      !TIME_KEYS.includes(key as TribePlanTimeKey) ||
      typeof day !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      typeof period !== "string" ||
      !PLAN_PERIODS.includes(period as PlanPeriod)
    ) {
      return [];
    }
    const typedKey = key as TribePlanTimeKey;
    const typedPeriod = period as PlanPeriod;
    return [
      {
        key: typedKey,
        day,
        period: typedPeriod,
        label: planTimeLabel(day, typedPeriod),
        votes: reactions[typedKey],
      },
    ];
  });
}
