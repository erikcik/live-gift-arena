// Writes sim/demo-timeline.json: the scripted viewer session behind the showcase video.
// Every event goes through the same Game.handle() as live TikTok events.
import { writeFileSync } from 'node:fs';

const ev = [];
const chat = (t, user, text) => ev.push({ t, type: 'chat', user, text });
const gift = (t, user, g, count = 1) => ev.push({ t, type: 'gift', user, gift: g, count });
const caption = (t, text, dur = 4.6) => ev.push({ t, type: 'caption', text, dur });
const likes = (t0, t1, perSec, users) => {
  let i = 0;
  for (let t = t0; t < t1; t += 0.3) ev.push({ t: +t.toFixed(2), type: 'like', user: users[i++ % users.length], count: Math.round(perSec * 0.3) });
};

caption(0.6, 'kimse yokken köylüler halayı çekiyor', 3.6);

caption(4.2, 'yoruma “halay” yazan halaya katılır');
chat(4.4, 'ayse.k', 'halay');
chat(5.3, 'mehmet_34', 'HALAY');
chat(6.1, 'zeynep.dnz', 'halay halay 💃');
chat(6.8, 'burak.gs', 'halay');
chat(7.5, 'elif.yldz', 'halayy');
chat(8.2, 'emre_can', 'halay');
chat(8.8, 'selin.ak', 'halay 🔥');
chat(9.5, 'kerem_06', 'halay');
chat(10.1, 'derya.m', 'halay');
chat(11.4, 'ayse.k', 'davul çok iyi 😍');

caption(12.6, '🌹 Gül → kırmızı mendil');
gift(12.8, 'oguzhan.tr', 'Rose');
gift(13.9, 'mehmet_34', 'Rose', 5);
gift(15.0, 'hatice_44', 'Rose');
chat(16.2, 'burak.gs', 'oha mendil 😂');

caption(17.4, '❤️ beğeniler davulu hızlandırır');
likes(17.5, 27, 85, ['ayse.k', 'kerem_06', 'derya.m', 'cem.krt', 'nazli.s', 'elif.yldz']);
ev.push({ t: 19.6, type: 'follow', user: 'cem.krt' });
ev.push({ t: 21.0, type: 'share', user: 'nazli.s' });

caption(22.4, '🫰 Parmak Kalp → yöresel kıyafet');
gift(22.6, 'zeynep.dnz', 'Finger Heart');
gift(23.8, 'selin.ak', 'Finger Heart', 3);

caption(26.0, '🍩 Donut → davulun başına geçer');
gift(26.2, 'umut.bey', 'Doughnut');

caption(29.6, '🧴 🫶 → havai fişek');
gift(29.8, 'ipek_', 'Perfume');
gift(31.0, 'tolga.ist', 'Hand Heart');
chat(32.6, 'kerem_06', 'halay başı kim olacak 👀');

caption(34.0, '🌌 Galaksi → yeni halay başı');
gift(34.2, 'muhlis', 'Galaxy');
chat(37.6, 'muhlis', 'çekin halayı 💪');
chat(38.8, 'derya.m', 'muhlis abi 🔥');
likes(36, 44, 50, ['selin.ak', 'emre_can', 'burak.gs']);
gift(40.2, 'ayse.k', 'Rose', 10);
gift(41.4, 'elif.yldz', 'Finger Heart');

caption(44.2, 'başka biri Galaksi atınca başlık el değiştirir');
gift(44.4, 'eray', 'Galaxy');
chat(47.6, 'eray', 'başlık bende 😎');
chat(48.8, 'muhlis', 'görürsün 😤');

caption(51.2, '🪐 Evren / 🦁 Aslan → SIKIŞTIR!', 5);
gift(51.4, 'muhlis', 'Universe');
likes(52, 60, 90, ['ayse.k', 'kerem_06', 'derya.m', 'cem.krt', 'zeynep.dnz']);
chat(59.4, 'zeynep.dnz', 'SIKIŞTIR 😭😭');
chat(60.4, 'mehmet_34', 'efsane');
gift(61.4, 'hatice_44', 'Rose', 3);
gift(62.4, 'kerem_06', 'Perfume');

caption(64.0, '🏆 en çok gönderenler: Halay Ustaları', 4.5);
chat(65.4, 'selin.ak', 'yarın da açın 🙏');
gift(66.4, 'derya.m', 'Finger Heart');

ev.push({ t: 70.5, type: 'endcard' });

ev.sort((a, b) => a.t - b.t);
writeFileSync(new URL('../sim/demo-timeline.json', import.meta.url), JSON.stringify({ duration: 76, events: ev }, null, 1) + '\n');
console.log(`wrote ${ev.length} events`);
