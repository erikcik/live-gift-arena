// Writes sim/demo-timeline.json: the scripted viewer session behind the showcase video.
// Every event goes through the same Battle.handle() as live TikTok events; times are in real seconds.
import { writeFileSync } from 'node:fs';

const ev = [];
const T = { usa: 0, india: 1 };
const chat = (t, user, text) => ev.push({ t, type: 'chat', user, text });
const gift = (t, user, team, g, count = 1) => ev.push({ t, type: 'gift', user, team: T[team], gift: g, count });
const likes = (t0, t1, user, team, perSec) => { for (let t = t0; t < t1; t += 0.4) ev.push({ t: +t.toFixed(2), type: 'like', user, team: T[team], count: Math.round(perSec * 0.4) }); };
const caption = (t, text, dur = 3.0) => ev.push({ t, type: 'caption', text, dur });

// Cold open: the armies are already fighting when a dragon arrives.
ev.push({ t: 0, type: 'prewarm', users: [['jake_tx', 0], ['priya.s', 1], ['mike.d', 0], ['arjun07', 1], ['emily_r', 0], ['rohan.k', 1], ['chris_b', 0], ['ananya__', 1], ['kayla.m', 0], ['sneha.r', 1]], kind: ['warrior', 'warrior', 'archer', 'warrior', 'warrior', 'archer', 'knight', 'warrior', 'warrior', 'knight'] });
gift(0.05, 'tyler99', 'usa', 'Galaxy');
ev.push({ t: 1.9, type: 'logo' });

caption(3.7, 'Comment 1 or 2 to pick a side', 3.0);
[['eray', '1'], ['muhlis', '2'], ['nick_ny', '1'], ['dev.patel', '2'], ['sam.w', '1'], ['aarav.k', '2'], ['ben.c', '1'], ['isha_m', '2']].forEach(([u, s], i) => chat(+(3.8 + i * 0.33).toFixed(2), u, s));

caption(6.9, '🌹 Rose = Warrior   🫰 Finger Heart = Archer', 3.0);
gift(7.0, 'jake_tx', 'usa', 'Rose', 3);
gift(7.5, 'priya.s', 'india', 'Rose', 3);
gift(8.1, 'mike.d', 'usa', 'Finger Heart', 2);
gift(8.6, 'arjun07', 'india', 'Finger Heart', 2);
gift(9.2, 'nick_ny', 'usa', 'Rose', 2);

caption(10.0, '❤️ Likes = arrow rain', 2.7);
likes(10.0, 12.4, 'kayla.m', 'usa', 140);
likes(10.3, 12.6, 'isha_m', 'india', 140);

caption(12.8, '🍩 Doughnut = Knight', 3.0);
gift(12.9, 'sam.w', 'usa', 'Doughnut');
gift(13.5, 'aarav.k', 'india', 'Doughnut', 2);
gift(14.2, 'ben.c', 'usa', 'Doughnut');
gift(14.8, 'ananya__', 'india', 'Rose', 4);

caption(15.9, '🫶 Hand Heart = Catapult strike', 3.0);
gift(16.0, 'rohan.k', 'india', 'Hand Heart');
gift(17.1, 'emily_r', 'usa', 'Hand Heart');

caption(18.9, '🌌 Galaxy = Dragon, with the gifter’s name on it', 3.2);
gift(19.2, 'muhlis', 'india', 'Galaxy');
gift(20.6, 'chris_b', 'usa', 'Rose', 3);
gift(21.4, 'dev.patel', 'india', 'Rose', 3);

gift(22.2, 'kayla.m', 'usa', 'Hand Heart', 4);
caption(24.6, 'USA fills its gift goal → EAGLE STRIKE', 3.0);
gift(25.6, 'priya.s', 'india', 'Doughnut', 3);
gift(26.4, 'sneha.r', 'india', 'Hand Heart', 3);
gift(27.0, 'dev.patel', 'india', 'Hand Heart', 2);
likes(27.0, 29.0, 'eray', 'usa', 100);
caption(29.7, 'India fills its goal → ELEPHANT STAMPEDE', 3.0);

caption(34.4, '🪐 Universe = METEOR STORM', 3.2);
gift(34.6, 'muhlis', 'india', 'Universe');

ev.push({ t: 48.6, type: 'endcard' });
ev.sort((a, b) => a.t - b.t);
writeFileSync(new URL('../sim/demo-timeline.json', import.meta.url), JSON.stringify({ duration: 52.5, events: ev }, null, 1) + '\n');
console.log(`wrote ${ev.length} events`);
