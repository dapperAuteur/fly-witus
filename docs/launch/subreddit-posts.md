# Subreddit launch posts

Three target communities. Each post lead with a use-case (per launch-prep doc), not "I built a thing." Read each subreddit's rules + last 30 days of removed posts before posting.

---

## r/Part107 — Use-case lead

**Title** *(picks one of two)*

A) `Built a Part 107 pre-flight checklist that works offline. Free for solo, paid for crews. Feedback wanted.`

B) `Tired of losing checklist progress when LTE drops at the takeoff site? Try this.`

**Body**

I'm a Part 107 pilot. Last month I missed three items on a checklist because my phone dropped to one bar mid-walk-around and the app I was using couldn't save state without a round-trip. So I built one that works without a network.

**fly.witus.online** — offline-first PWA, 8 sections / 50+ items aligned to Part 107, NOAA gridpoint forecast for weather, jsPDF export that passes the Part 107 rubric (no print dialog — works in iOS Safari).

Free for solo pilots, no account required. Paid plans ($10.60/mo, $103.29/yr, $103.29 lifetime — 100 slots) add multi-device cloud sync, photo attachments, and groups for crews / BVC partners.

I'd love feedback on:
- Anything missing from the checklist for your typical commercial mission
- Edge cases on the weather lookup (paste a ZIP that should fail and tell me what you got)
- Whether the PDF format clears your insurance / client paper trail

Open source: <https://github.com/dapperAuteur/fly-witus>

Built solo, MIT-licensed.

**Optional comment to add after posting**

> Happy to also share what I deliberately *cut* — there's no map overlay, no risk-score auto-calc, no airspace LAANC integration in v1. That's all on the roadmap, but I wanted the checklist + log + offline + PDF to actually work first before bolting on the next thing.

---

## r/drones — Lighter-weight version

**Title**

`Free pre-flight checklist + flight log app. Works offline. Real PDF export.`

**Body**

Made for hobby + Part 107. Open source. No ads, no tracking.

- Full 50-item pre-flight checklist
- Multi-flight log per mission
- Battery voltage tracking
- Weather snapshot (NOAA, no API key)
- Real PDF export (not a `.txt` rename — actual jsPDF)
- Works without a network at the takeoff site
- Free forever for solo

If you fly with a crew or want multi-device sync, there's a paid tier ($10.60/mo or one-time $103.29). Otherwise the free tier covers everything most hobbyists need.

🌐 <https://fly.witus.online>
🐙 <https://github.com/dapperAuteur/fly-witus>

Bug reports + feature requests welcome.

---

## r/UAVmapping — Niche / professional angle

**Title**

`Open-source pre-flight + mission log built around BVC / primary-source workflows`

**Body**

Posting here because the BVC (Body of Visual Content) primary-source workflow is finally something an off-the-shelf logbook supports.

The mission record carries:
- BVC episode reference
- Wanderlearn course slug
- Partner institution
- Academic purpose
- Standard Part 107 fields (LAANC auth number, weather, battery state, photo attachments via Cloudinary)

If you're flying for a documentary, university research, or any context where the per-flight metadata gets cited later, this is the schema.

The crew side (paid plan) lets one member post a "flight request" — e.g. *"capture 360° canopy in Hoosier National Forest for the guayusa episode"* — and another member claims it, flies it, and links the completed mission. Auto-shares to the group feed; original requester gets an email.

🌐 <https://fly.witus.online>
🐙 <https://github.com/dapperAuteur/fly-witus> — MIT

Honest question for this community: what fields am I missing in the mission record for mapping/orthomosaic work specifically? I have weather + flight times + photos but nothing about altitude AGL, overlap %, ground-sample distance, or PPK/RTK status. Worth adding before launch or later?

---

## Day-of moderation playbook

- **First 30 minutes:** monitor each thread, reply to every top comment within 5 minutes
- **Hour 1:** if a thread is gaining traction, ladder up — invite questions in the body
- **Hour 4–6:** if dead, DON'T re-post or bump
- **24h:** edit OP with `EDIT 24h: thanks for X feedback, I shipped Y` if there were actionable bug reports
- **Never:** never delete the post even if dead — Reddit penalizes deletion velocity

## What NOT to do

- No cross-posting from r/Part107 to r/drones to r/UAVmapping in the same hour — looks spammy
- No "Show HN" tone in subreddit posts — it reads as a pitch
- No mentioning Hacker News, Product Hunt, or other launch venues in Reddit posts
- No links to the pricing page in the post body — let people find it from the home page
