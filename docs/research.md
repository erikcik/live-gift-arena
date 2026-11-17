# Research: gift-reactive TikTok LIVE scenes

Checked 2026-11-17. Sources are linked inline. "Vendor" means a seller's product page, and "press" means a news
article describing streams second-hand. Nobody on the team has watched these streams yet, so every gift mapping
below is as reported and has not been observed.

## The trend in Turkey (November 2026)

| Format | What happens | Source |
| --- | --- | --- |
| **Halay / horon circle** | Animated characters dance in a circle. Typing `HALAY` or `HORON` in chat joins you. A Rose adds you, another gift makes you the kemençe player, the top gifter becomes *horon başı*, and likes speed up the dance. | [CNBC-e, 9 Nov](https://www.cnbce.com/teknoloji/tiktokta-yeni-akim-halay-ve-horon-cektirerek-para-kazaniyorlar-h41380), [GZT, 9 Nov](https://www.gzt.com/hayat/tiktok-halay-yayinlari-horon-akimi-neden-izleniyor-ne-kadar-kazandiriyor-4276953) |
| **Şehzade Mustafa funeral** | A virtual funeral procession. Commenting "Mustafa" puts you in it, gift senders move to the front rows, and bigger gifts get better spots. About 1,600 viewers. | [Onedio, 17 Nov](https://onedio.com/haber/tiktok-ta-sehzade-mustafa-nin-cenaze-toreni-yayini-acildi-hediye-atan-en-on-safa-geciyor-1395642), [Takvim, 17 Nov](https://www.takvim.com.tr/yasam/2026/11/17/tiktokta-din-ve-tarih-istismari-tavaf-da-cenaze-de-jetona-baglandi) |
| **Kâbe tavaf** | Avatars circle a 3D Kâbe, with gift tiers mapped to rituals and a top-5 ranking. Strong press backlash. | [Türkiye Gazetesi, 17 Nov](https://www.turkiyegazetesi.com.tr/gundem/tiktokta-rezaletin-siniri-yok-kabede-tavaftan-cenazeye-halaydan-pavyona-1829908) |
| **Wedding convoy** | Each viewer has a car in a convoy, and gifts speed it up or move it to the front. | Türkiye Gazetesi, 17 Nov; [Sayıyla, 6 Nov](https://sayiyla.com/yazilar/yapay-zeka-ile-tiktok-yayini-nasil-yapilir/) |
| **Slime (the precursor)** | A real couple makes giant slime, and gifts fund each ingredient. One stream peaked around 65k concurrent viewers. | [Evrensel, 8 Nov](https://www.evrensel.net/haber/6008469/kafada-kese-kagidiyla-tiktok-yayini-slime-pazari-neden-buyudu) |

**Off-the-shelf competitors already sell halay games:** [TikQo "Halay Gecesi"](https://tikqo.com/oyun/halay-gecesi)
($10.10, Windows only) and [TikTokOyunları "Halay"](https://tiktokoyunlari.com/oyun/halay-tiktok-oyunu) (499 TL).
The Kâbe game's source code reportedly sells for 749 TL. Our edge has to be quality (look, music, feel), better
mechanics, and owning the code.

**Reported mappings from those products** (vendor pages, a useful starting point):

- **Rose (1 coin)** is the entry ticket. You join the circle with a handkerchief (*mendil*).
- **Mid gifts** (Finger Heart, Donut, Perfume, Hand Heart, Ice cream) give a role or a cosmetic: a gold-embroidered outfit, the kemençe, the leader's crown, fireworks, a faster tempo.
- **Big gifts** (Corgi, Galaxy, Sports car, Lion, Universe) set off a group-wide spectacle: "SIKIŞTIR!" (the circle squeezes together), giant fireworks.
- **Chat keyword** (`HALAY`) joins you for free, and **likes** raise the tempo.
- **Names**: the viewer's name floats above their dancer, their chat shows in a speech bubble, and combos merge ("x5").
- **Retention**: a live top-5 board ("Halay Ustaları"), one leader role that others outbid, and points that carry over between streams.
- **Idle**: one vendor stresses that the game "starts on its own and never stops". There is never an empty screen.

Elsewhere, in English: a gel-blaster stream mapped gifts to shots (Rose = 1, Galaxy = 1,888;
[Dexerto, 7 Aug](https://www.dexerto.com/tiktok/tiktok-viewers-are-paying-to-shoot-streamer-with-thousands-of-pellets-at-a-time-3395929/)),
and country races and rope pulls exist as paid games.

**Risk signal.** On 11 Nov 2026 the Ankara prosecutor announced an investigation into money laundering through
high-value LIVE gifts, with 11 suspects detained (Türkiye Gazetesi, 17 Nov). Religious and funeral formats are
drawing heavy press criticism ("din ve tarih istismarı").

## Getting live events

- **No official TikTok API for LIVE events** was found. Everyone uses reverse-engineered libraries or tools built on them.
- **[zerodytrash/TikTok-Live-Connector](https://github.com/zerodytrash/TikTok-Live-Connector)** (Node, AGPL-3.0, 2,324★, v2.5.0 on 2026-09-16)
  - Events: `gift`, `like`, `follow`, `share`, `chat`, `member`, `roomUser`, `subNotify`, `goalUpdate` and more.
  - Needs a signing token from [Euler Stream](https://www.eulerstream.com/pricing). The free Community plan allows 1.5k requests/day, 100 rooms/day and 25 concurrent sockets, which is plenty for one stream.
  - Reading any public LIVE needs no credentials, so we can test against real streams before we have our own.
  - Its README says it is not production-grade and breaks when TikTok changes the protocol.
- **[isaackogan/TikTokLive](https://github.com/isaackogan/TikTokLive)** (Python, AGPL-3.0, 1,657★) is the equivalent.
  - Gift streaks fire repeated events with `repeat_count`, and the last one has `repeat_end`.
  - Apply a streak once, or per increment, and dedupe.
- **TikFinity** (free and Pro) exposes a local WebSocket at `ws://localhost:21213/` with the same payload shape. The desktop app is Windows only.
- **Streamer.bot** is Windows only and gets its TikTok events through TikFinity. Not useful on a Mac.

## Going live from a computer

- **[TikTok LIVE Studio](https://www.tiktok.com/studio/download)** runs on macOS and Windows (help center, updated Mar 2026). It needs an M1 or newer Mac with 8 GB+ RAM.
  - Access is granted to active LIVE creators, or by application.
  - It can show a web page as a source.
- **OBS** needs a TikTok Server URL and Stream Key. Who gets a key varies by account and region; often it takes LIVE Center eligibility or a creator network.
- Our scene runs as a **web page** (OBS Browser Source, or a LIVE Studio link/browser source).

## Eligibility

- **18+** to go LIVE and to send or receive gifts.
- A **follower minimum** to go LIVE ("may vary by region"). Guides say 1,000, but TikTok publishes no number.
- **Gifts** need a region where they're available, LIVE eligibility, and an account in good standing.
- **A brand-new account will probably not qualify for LIVE or gifts.** The account owner should check on the actual account: LIVE access, LIVE Studio access, whether a stream key appears, and the payout method in Türkiye.

## Policy: what keeps the account safe

From TikTok's [LIVE Monetization Guidelines](https://www.tiktok.com/live/creators/en-US/live-monetization-guidelines/) and [Community Guidelines](https://www.tiktok.com/community-guidelines) (effective 24 Sep 2026):

1. **A host must be present.**
   - The guidelines name content that is "generated or operated primarily through automated systems ... without meaningful creator presence, interaction, or facilitation" as ineligible for monetization.
   - They do the same for "pre-recorded ... looping videos" and "largely passive, repetitive, unattended" streams.
   - **Design for a host on camera or mic who runs the show.** The scene is the set, not the whole stream.
2. **No gift begging.** Out: "mechanically and repeatedly solicits viewers to increase Gifts", "offering likes, follows, or Gifts in exchange for engagement", and pressuring viewers through emotion or obligation. No looping "SEND GIFTS" text.
3. **Be careful with team battles.** "Creators solely present two or more opposing viewpoints and ask viewers to send Gifts" is flagged. Make teams playful (colours, villages, cities as fun), never factions.
4. **No real gangs, no religious or ethnic conflict.**
   - Violent criminal organizations can't be promoted in any way. That rules out Bloods vs Crips.
   - Hate speech, and "content that disparages religion", get reduced reach or removal.
   - "Polarizing" or "inflammatory" content loses monetization.
   - Religious-war and gang themes risk a ban, not just demonetization.
5. **No gambling mechanics.** No paid spins, random reward draws or raffles tied to gifts.
6. **Creators are accountable for third-party tools** they run.

## Money (approximate, secondary sources)

- A coin costs about 1.05–1.4 US cents.
- Gifts turn into diamonds at roughly 2 coins per diamond, and a diamond is worth about $0.005.
- So the creator nets about 18–24% of what the viewer pays once store markups are counted.
- Payout minimums are about $50–100.
- Türkiye payout methods are unconfirmed. Check Balance in TikTok Studio on the real account.
