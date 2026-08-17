// Self-serve help docs. Authored as structured data (not markdown +
// parser) so the content is both rendered without a runtime dependency
// AND directly indexable for fuzzy search (src/lib/help-search.ts reads
// these fields). Add a doc by appending to HELP_DOCS; the index page and
// [slug] route pick it up automatically.

export type HelpBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: string[] };

export interface HelpDoc {
  slug: string;
  title: string;
  category: string;
  summary: string;
  // Extra search terms that may not appear verbatim in the prose.
  keywords: string[];
  body: HelpBlock[];
}

export const HELP_CATEGORIES = [
  "Getting started",
  "Missions & flights",
  "Groups",
  "Account",
  "Billing",
  "Troubleshooting",
] as const;

export const HELP_DOCS: HelpDoc[] = [
  {
    slug: "getting-started",
    title: "Getting started with Fly WitUS",
    category: "Getting started",
    summary:
      "What Fly WitUS does, how to run your first pre-flight checklist, and whether you need an account.",
    keywords: ["intro", "first time", "new", "overview", "anonymous", "sign in"],
    body: [
      {
        kind: "paragraph",
        text: "Fly WitUS is a UAS (drone) pre-flight checklist and flight-log app for Part 107 and recreational pilots. You complete a pre-flight checklist, log your flights, attach photos, and export a mission record as PDF (for FAA compliance) or JSON (for backup).",
      },
      { kind: "heading", text: "Do I need an account?" },
      {
        kind: "paragraph",
        text: "No. The checklist works fully without signing in — your missions are saved in your browser's local storage on that device only. Sign in (free) to sync missions across devices and unlock cloud features; a paid plan adds Groups and flight requests.",
      },
      { kind: "heading", text: "Run your first checklist" },
      {
        kind: "steps",
        items: [
          "Open the home page (the checklist).",
          "Fill in Pilot Name, Location, and Aircraft Type — these are required.",
          "Optionally tap 'Use My Location' or enter a ZIP to auto-fill weather from NOAA.",
          "Work through the checklist items; the progress bar tracks required items.",
          "Add flights and photos as needed, then tap 'Complete & Save Mission'.",
          "Find saved missions on your Dashboard, where you can export them as PDF or JSON.",
        ],
      },
    ],
  },
  {
    slug: "missions-and-flights",
    title: "Missions, flights, and exporting",
    category: "Missions & flights",
    summary:
      "How missions and flights relate, editing a saved mission, and exporting to PDF or JSON.",
    keywords: ["mission", "flight log", "pdf", "json", "export", "edit", "delete", "photos"],
    body: [
      {
        kind: "paragraph",
        text: "A mission is one outing: the checklist you completed plus its details, weather, photos, and one or more flight records. Each flight captures takeoff/landing location and time, elapsed time, battery voltage, and notes.",
      },
      { kind: "heading", text: "Editing a saved mission" },
      {
        kind: "paragraph",
        text: "On the Dashboard, choose Edit on a mission. This reopens the checklist with that mission loaded; Save updates the existing record instead of creating a new one. You'll see an 'Editing mission' banner while in edit mode.",
      },
      { kind: "heading", text: "Exporting" },
      {
        kind: "list",
        items: [
          "PDF — a formatted mission record suitable for FAA Part 107 documentation, with photos embedded.",
          "JSON — the raw mission data for backup or import elsewhere.",
        ],
      },
      { kind: "heading", text: "Photos" },
      {
        kind: "paragraph",
        text: "Attach photos to document equipment condition, weather, or site hazards. They appear in the exported PDF. Signed-in users' photos sync to the cloud.",
      },
    ],
  },
  {
    slug: "groups-and-invites",
    title: "Groups, invite codes, and flight requests",
    category: "Groups",
    summary:
      "Create or join a group, share missions, and use flight requests. Groups require a paid plan.",
    keywords: ["group", "invite code", "join", "share mission", "flight request", "team", "club"],
    body: [
      {
        kind: "paragraph",
        text: "Groups let pilots share missions and coordinate flights. Creating or joining a group requires a Cloud or Lifetime plan.",
      },
      { kind: "heading", text: "Create a group" },
      {
        kind: "steps",
        items: [
          "Go to Groups and choose '+ New group'.",
          "Give it a name and optional description.",
          "Share the group's invite code or invite link from the Invite tab.",
        ],
      },
      { kind: "heading", text: "Join a group" },
      {
        kind: "paragraph",
        text: "On the Groups page, paste an 8-character invite code into 'Join with invite code', or open an invite link someone sent you. If you're on the Free plan you'll be prompted to upgrade; your code is saved so you can finish joining after upgrading.",
      },
      { kind: "heading", text: "Share a mission to a group" },
      {
        kind: "paragraph",
        text: "From the Dashboard, choose 'Share to group' on a saved mission, pick the group, and add an optional note. Group members see it in the group's Shared Missions tab.",
      },
      { kind: "heading", text: "Flight requests" },
      {
        kind: "paragraph",
        text: "A flight request asks a group member to fly a mission (for example, capture footage for a project). Members can claim a request, start it, and complete it by linking the mission they flew — which auto-shares that mission to the group and emails the requester.",
      },
    ],
  },
  {
    slug: "aircraft-profiles",
    title: "Aircraft profiles",
    category: "Missions & flights",
    summary:
      "Save your aircraft so you can pre-fill mission details instead of re-typing them every flight.",
    keywords: ["aircraft", "profile", "drone", "model", "registration", "weight"],
    body: [
      {
        kind: "paragraph",
        text: "An aircraft profile stores a drone's name, model, weight, registration number, and notes so you can pre-fill the mission form instead of typing it each time.",
      },
      { kind: "heading", text: "Manage profiles" },
      {
        kind: "paragraph",
        text: "On the Dashboard, use the Aircraft section to add, edit, or delete profiles. Deleting an aircraft keeps the flight history of past missions — those missions simply no longer reference the deleted profile.",
      },
    ],
  },
  {
    slug: "group-meetups",
    title: "Planning group meetups",
    category: "Groups",
    summary:
      "Schedule an in-person flight meetup: propose times, collect everyone's availability, lock in a time, and add it to your calendar.",
    keywords: [
      "meetup",
      "meet up",
      "schedule",
      "event",
      "availability",
      "calendar",
      "ics",
      "reminder",
      "doodle",
      "time",
    ],
    body: [
      {
        kind: "paragraph",
        text: "In a group, the Meetups tab lets members plan in-person flights together. A group can have as many meetups going at once as you like.",
      },
      { kind: "heading", text: "How it works" },
      {
        kind: "steps",
        items: [
          "Any member taps '+ New meetup', gives it a title and optional location, and proposes one or more candidate times.",
          "Other members open the meetup and add more candidate times, and mark each time as 'I'm free', 'Maybe', or 'Can't'.",
          "The meetup's creator (or a group owner/admin) picks the winning time with 'Pick this time'. The meetup is then Confirmed.",
          "Everyone can tap 'Add to calendar' to download the event (.ics) for Apple/Google/Outlook.",
        ],
      },
      { kind: "heading", text: "Reminders" },
      {
        kind: "paragraph",
        text: "Once a time is confirmed, group members get an email reminder before the meetup. (Push notifications are planned for a later update.)",
      },
      { kind: "heading", text: "Managing a meetup" },
      {
        kind: "paragraph",
        text: "The creator and group owners/admins can re-open a confirmed meetup to gather new times, mark it completed, cancel it, or delete it. Groups require a Cloud or Lifetime plan.",
      },
    ],
  },
  {
    slug: "account-management",
    title: "Managing your account",
    category: "Account",
    summary:
      "Sign-in (magic link), changing your email, exporting your data, signing out everywhere, and deleting your account.",
    keywords: [
      "account",
      "email",
      "change email",
      "password",
      "magic link",
      "sign out",
      "delete account",
      "export data",
      "gdpr",
      "privacy",
    ],
    body: [
      { kind: "heading", text: "How sign-in works" },
      {
        kind: "paragraph",
        text: "Fly WitUS uses passwordless magic-link sign-in: enter your email and we send a one-time link that signs you in. There is no password to remember or reset. Links expire after 15 minutes and can be used once.",
      },
      { kind: "heading", text: "Change your email" },
      {
        kind: "paragraph",
        text: "In Dashboard → Account, request an email change. We send a verification link to the new address; the change takes effect once you click it. Until then, your old email stays active.",
      },
      { kind: "heading", text: "Export your data" },
      {
        kind: "paragraph",
        text: "From Dashboard → Account, choose Export my data to download a JSON file containing your profile, missions, flights, photos, and aircraft profiles.",
      },
      { kind: "heading", text: "Sign out everywhere" },
      {
        kind: "paragraph",
        text: "If you signed in on a shared or lost device, use 'Sign out everywhere' in Dashboard → Account to invalidate all active sessions. You'll need a fresh magic link to sign back in.",
      },
      { kind: "heading", text: "Delete your account" },
      {
        kind: "paragraph",
        text: "Dashboard → Account → Delete account permanently removes your account and your cloud data (missions, flights, photos, aircraft, and group memberships). This cannot be undone. Locally-stored missions on your device are not affected.",
      },
    ],
  },
  {
    slug: "billing-and-cashapp",
    title: "Plans, billing, and CashApp",
    category: "Billing",
    summary:
      "Free vs Cloud vs Lifetime, paying by card or CashApp, and what each plan unlocks.",
    keywords: ["pricing", "plan", "cloud", "lifetime", "cashapp", "stripe", "upgrade", "billing", "payment"],
    body: [
      {
        kind: "paragraph",
        text: "Free includes the checklist, PDF export, and a local mission log. Cloud adds cross-device sync, Groups, flight requests, and analytics. Lifetime is a one-time purchase that includes all Cloud features and future updates with no renewal.",
      },
      { kind: "heading", text: "How to pay" },
      {
        kind: "list",
        items: [
          "Card — Cloud (monthly or annual) and Lifetime can be purchased by card at checkout.",
          "CashApp — Lifetime can also be paid via CashApp; after you send payment we activate your account (this is reviewed, so it isn't instant).",
        ],
      },
      {
        kind: "paragraph",
        text: "See the Pricing page for current prices and remaining Lifetime slots. If a Lifetime re-open promo is active, it appears there.",
      },
    ],
  },
  {
    slug: "offline-and-install",
    title: "Offline use and installing the app",
    category: "Getting started",
    summary:
      "Fly WitUS works offline and installs as an app. How syncing works when you reconnect.",
    keywords: ["offline", "pwa", "install", "home screen", "sync", "outbox", "no signal"],
    body: [
      {
        kind: "paragraph",
        text: "Fly WitUS is a Progressive Web App (PWA). You can install it to your home screen and use the checklist in the field without a signal.",
      },
      { kind: "heading", text: "Offline syncing" },
      {
        kind: "paragraph",
        text: "When signed in, missions you save offline are queued and sync automatically when you're back online. An 'Offline' or 'Syncing' indicator on the checklist shows pending items. Anonymous (signed-out) missions stay on the device only.",
      },
      { kind: "heading", text: "Install it" },
      {
        kind: "paragraph",
        text: "In your mobile browser, use 'Add to Home Screen'. On desktop Chrome/Edge, use the install icon in the address bar.",
      },
    ],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    category: "Troubleshooting",
    summary:
      "Fixes for common issues: missions not loading, groups errors, weather lookup, and exports.",
    keywords: ["error", "500", "not loading", "broken", "weather", "noaa", "pdf failed", "help", "bug"],
    body: [
      { kind: "heading", text: "Aircraft or Groups won't load" },
      {
        kind: "paragraph",
        text: "If a section shows a load error, refresh the page. If it persists, use the Help bubble (bottom-right) to report it — include what you were doing. The report reaches us with the page and your browser details so we can reproduce it.",
      },
      { kind: "heading", text: "Weather lookup fails" },
      {
        kind: "paragraph",
        text: "Weather comes from NOAA. If 'Use My Location' is denied or NOAA is unreachable, enter a 5-digit ZIP for the ZIP lookup, or type the weather fields in manually.",
      },
      { kind: "heading", text: "PDF or JSON export issues" },
      {
        kind: "paragraph",
        text: "Exports download a real file. On iOS Safari, the file is saved via the share/downloads flow. If a photo-heavy PDF is slow, give it a moment — photos are embedded before the file is produced.",
      },
      { kind: "heading", text: "Still stuck?" },
      {
        kind: "paragraph",
        text: "Open the Help bubble and send a bug report or question. You can attach a screenshot (or paste one into the message) or record your screen right from the widget to show us the problem. You don't need to be signed in — add your email so we can reply.",
      },
    ],
  },
  {
    slug: "personal-minimums",
    title: "Personal minimums",
    category: "Missions & flights",
    summary:
      "Set the wind, gust, crosswind, and cloud limits you fly in, and have every pre-flight check the forecast against them.",
    keywords: [
      "minimums",
      "wind",
      "gust",
      "crosswind",
      "limits",
      "comfort",
      "weather",
      "knots",
      "runway heading",
    ],
    body: [
      {
        kind: "paragraph",
        text: "Personal minimums are the conditions you have decided in advance that you fly in. Deciding them on the ground, calmly, is the point — it is much easier to hold a limit you set last week than one you are inventing while a client waits.",
      },
      { kind: "heading", text: "Setting your limits" },
      {
        kind: "steps",
        items: [
          "Scroll to the Personal Minimums panel on the checklist page.",
          "Enter a maximum sustained wind and gust in knots.",
          "Optionally add a maximum cloud cover percentage.",
          "Leave any field blank to skip that check entirely.",
        ],
      },
      {
        kind: "paragraph",
        text: "Limits are saved on the device you set them on. They are not synced between devices yet.",
      },
      { kind: "heading", text: "Crosswind" },
      {
        kind: "paragraph",
        text: "To check a crosswind limit we also need a runway or landing direction, because a crosswind only exists relative to the direction you are landing. Enter that heading in degrees TRUE — not the painted runway number, which is magnetic. If you leave it blank, the crosswind limit is shown as unchecked rather than quietly ignored.",
      },
      { kind: "heading", text: "What the results mean" },
      {
        kind: "list",
        items: [
          "Within limits — the forecast value is comfortably inside the number you set.",
          "At your limit — the forecast is at or very close to your limit. Worth a second look.",
          "Outside your limits — the forecast exceeds what you said you fly in.",
          "Not reported — the forecast did not include that value, so we could NOT check it. This is not the same as passing.",
        ],
      },
      {
        kind: "paragraph",
        text: "That last one matters. National Weather Service coverage is uneven and some values are simply absent for some locations. We will never show a green check for a value nobody measured, because that would be the most misleading thing this feature could do.",
      },
      {
        kind: "paragraph",
        text: "All of it is advisory. These are your own numbers checked against a forecast — not a clearance, and not a legal determination. Conditions on site can differ from any forecast, and the decision to fly is yours.",
      },
    ],
  },
  {
    slug: "risk-assessment",
    title: "Pre-flight risk assessment",
    category: "Missions & flights",
    summary:
      "How the PAVE-structured risk score is built, what it covers, and — importantly — what it does not cover.",
    keywords: [
      "risk",
      "FRAT",
      "PAVE",
      "go no-go",
      "score",
      "daylight",
      "sunset",
      "pressure",
      "safety",
    ],
    body: [
      {
        kind: "paragraph",
        text: "The risk assessment is a structured prompt to think before you fly. It groups factors using PAVE — Pilot, Aircraft, enVironment, External pressures — the same framework taught in general aviation, so it should read as something familiar rather than a number we invented.",
      },
      { kind: "heading", text: "What it looks at today" },
      {
        kind: "list",
        items: [
          "Weather against your personal minimums.",
          "Daylight remaining after your planned flight time, computed from your launch location.",
          "Whether you are under schedule or client pressure — you tell it this.",
          "Whether the site is new to you.",
        ],
      },
      { kind: "heading", text: "What it does NOT look at" },
      {
        kind: "paragraph",
        text: "Pilot fitness and aircraft condition are not assessed yet. Rather than score them as fine, we leave them out of the maths entirely and label them 'not assessed' — a score that looked at half the picture and reported low risk would be worse than no score at all. Assess both yourself before you fly.",
      },
      { kind: "heading", text: "Reading the result" },
      {
        kind: "paragraph",
        text: "The band — low, moderate, elevated, or high — always comes with what drove it and what to do about it. A number on its own is not useful. Note that any single serious factor pushes the band to at least elevated: three fine things do not average out one real problem.",
      },
      {
        kind: "paragraph",
        text: "Advisory only. This is not a clearance, an authorisation, or a legal determination, and it does not decide whether an operation is permitted. That judgement is yours as pilot in command.",
      },
    ],
  },
  {
    slug: "daylight-and-flight-time",
    title: "Daylight and flight time",
    category: "Missions & flights",
    summary:
      "Sunrise, sunset, and civil twilight for your launch site, and how elapsed flight time is filled in for you.",
    keywords: [
      "sunset",
      "sunrise",
      "twilight",
      "daylight",
      "night",
      "hobbs",
      "tachometer",
      "elapsed",
      "flight time",
      "duration",
    ],
    body: [
      { kind: "heading", text: "Daylight" },
      {
        kind: "paragraph",
        text: "Once you have set a launch location — by fetching weather from your position or by entering a ZIP code — we compute sunrise, sunset, and civil twilight for that exact spot. The calculation runs on your device, so it keeps working with no signal.",
      },
      {
        kind: "paragraph",
        text: "These are astronomical times, accurate to about a minute at sea level. They are not a statement about what is legal: rules on night operation differ, have changed over the years, and depend on your equipment and authorisations. Check the current regulations for your operation.",
      },
      { kind: "heading", text: "Flight time" },
      {
        kind: "paragraph",
        text: "A drone has no hobbs meter and no tachometer, so nothing on board counts hours for you. Enter a launch time and a landing time and the elapsed time fills itself in, including for flights that cross midnight. The mission totals every flight you log.",
      },
      {
        kind: "paragraph",
        text: "If you type your own elapsed time, we keep it. Your entry always wins over ours — it is your logbook.",
      },
    ],
  },
];

export function getHelpDoc(slug: string): HelpDoc | undefined {
  return HELP_DOCS.find((d) => d.slug === slug);
}

// Flatten a doc's searchable text once, for indexing.
export function helpDocText(doc: HelpDoc): string {
  const blockText = doc.body
    .map((b) => ("text" in b ? b.text : b.items.join(" ")))
    .join(" ");
  return [doc.title, doc.summary, doc.category, doc.keywords.join(" "), blockText].join(
    " ",
  );
}
