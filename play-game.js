const { io } = require("socket.io-client");
const fs = require("fs");
const out = msg => { fs.writeSync(1, msg + "\n"); };
const URL = "http://localhost:3100";
const wait = ms => new Promise(r => setTimeout(r, ms));
const PWR = { infantry: 1, artillery: 6, tanks: 15, aircraft: 12, ships: 10 };
const power = p => Object.entries(p.units).reduce((a, [k, v]) => a + v * (PWR[k] || 1), 0);

async function main() {
  const me = io(URL, { transports: ["websocket"] });
  let st = null, myName = "Vibe", daySeen = 0, conquests = 0;
  const errors = [];
  me.on("errorMessage", m => errors.push(m));
  me.on("state", s => st = s);

  const createdP = new Promise(res => me.once("created", res));
  me.emit("createGame", { name: myName, cheats: false, settings: null });
  const { code, hostToken } = await createdP;
  await wait(200);
  out("=== Partie créée : code " + code + " (créateur, sans triche) ===");
  me.emit("chooseNation", { nationId: "france" });
  await wait(150);
  me.emit("startGame", { hostToken, bots: true });
  await wait(300);
  out("Je commande 🇫🇷 la France contre 9 IA. Objectif : 150 provinces.\n");

  const mine = () => st.provinces.filter(p => p.owner === "france");
  let frontId = null;

  const timer = setInterval(() => {
    if (!st || !st.started || st.over) return;
    if (st.day === daySeen) return;
    daySeen = st.day;
    const mineProvs = mine();
    if (!mineProvs.length) return;
    const border = mineProvs.filter(p => st.adjacency[p.id].some(t => { const q = st.provinces.find(x => x.id === t); return q && q.owner !== "france"; }));
    const pool = border.length ? border : mineProvs;
    const front = pool.find(p => p.id === frontId) || pool.reduce((a, p) => (power(p) > power(a) ? p : a), pool[0]);
    frontId = front.id;
    const myPid = st.players.find(p => p.name === myName).id;
    const tres = st.treasury[myPid];
    if (tres.money >= 900 && tres.food >= 600) me.emit("recruit", { unit: "infantry", amount: 300, provinceId: front.id });
    else if (tres.money >= 240 && tres.iron >= 80) me.emit("recruit", { unit: "artillery", amount: 20, provinceId: front.id });
    const targets = st.adjacency[front.id].map(t => st.provinces.find(x => x.id === t)).filter(q => q && q.owner !== "france");
    if (!targets.length) { frontId = null; return; }
    targets.sort((a, b) => power(a) - power(b));
    const tgt = targets[0];
    const sent = Object.entries(front.units).reduce((a, [k, v]) => { const n = Math.floor(v * 0.8); if (n > 0) a[k] = n; return a; }, {});
    const sentPower = Object.entries(sent).reduce((a, [k, v]) => a + v * PWR[k], 0);
    const defPower = power(tgt) * (tgt.buildings.fort > 0 ? 1.4 : 1);
    if (sentPower > defPower * 1.45) {
      const tgtOwner = tgt.owner;
      me.emit("attack", { from: front.id, to: tgt.id, fraction: 0.8 });
      out(`Jour ${st.day} : offensive de ${front.name} vers ${tgt.name} (${tgtOwner}) — ${Math.round(sentPower).toLocaleString("fr-FR")} vs défense ~${Math.round(defPower).toLocaleString("fr-FR")}`);
    }
  }, 80);

  const start = Date.now();
  while (!st.over && st.day < 400 && Date.now() - start < 100000) {
    await wait(500);
    if (st.day >= daySeen + 25) out(`... jour ${st.day} — provinces françaises : ${mine().length}/210`);
  }
  clearInterval(timer);

  out("\n=== FIN DE LA PARTIE (jour " + st.day + ") ===");
  if (st.over) out("🏆 Vainqueur : " + st.winner + (st.winner === "France" ? " 🎉 (c'est moi !)" : ""));
  else out("Partie stoppée pour la démo (pas de vainqueur encore).");
  const count = {};
  for (const p of st.provinces) count[p.owner] = (count[p.owner] || 0) + 1;
  out("Contrôle des provinces : " + Object.entries(count).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + "=" + v).join(", "));
  out("\n--- Dernières lignes du journal de guerre ---");
  for (const x of st.log.slice(-12)) out(x.msg);
  out("\nErreurs reçues du serveur : " + (errors.length ? errors.slice(0, 5).join(" | ") : "aucune"));
  me.close();
  setTimeout(() => process.exit(0), 300);
}
main().catch(e => { try { fs.writeSync(2, String(e && e.stack || e)); } catch (_) {} process.exit(1); });
