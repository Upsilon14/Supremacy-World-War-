const { io } = require("socket.io-client");
const URL = "http://localhost:3100";

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function waitFor(sock, ev, ms = 4000) {
  return Promise.race([
    new Promise(res => sock.once(ev, res)),
    new Promise(res => setTimeout(() => res("TIMEOUT-" + ev), ms))
  ]);
}
let failures = 0;
function check(cond, label) {
  console.log((cond ? "PASS" : "FAIL") + " - " + label);
  if (!cond) failures++;
}

async function main() {
  const host = io(URL, { transports: ["websocket"] });
  const player = io(URL, { transports: ["websocket"] });

  const createdP = new Promise(res => host.once("created", res));
  host.emit("createGame", { name: "Créateur", cheats: true, settings: { startMoney: 5000, hostBonus: 2 } });
  const { code, hostToken } = await createdP;
  check(!!code && !!hostToken, "création de partie renvoie code + hostToken");

  let hostState = null, playerState = null;
  host.on("state", s => hostState = s);
  player.on("state", s => playerState = s);
  player.emit("joinGame", { name: "Joueur1", code });
  await waitFor(player, "state");
  await wait(200);
  check(playerState.players.length === 2, "le joueur a rejoint (2 joueurs)");
  check(playerState.provinces.length === 210, "la carte contient 210 provinces");
  check(hostState.cheats === true, "l'état expose cheats=true");
  check(hostState.nations.length === 10, "10 nations présentes");

  player.emit("chooseNation", { nationId: "france" });
  host.emit("chooseNation", { nationId: "germany" });
  await wait(300);
  const hostPid = () => hostState.players.find(p => p.name === "Créateur");
  check(playerState.players.find(p => p.name === "Joueur1").nation === "france", "le joueur commande la France");
  check(hostPid().nation === "germany", "le créateur commande l'Allemagne");

  host.emit("startGame", { hostToken, bots: true });
  await wait(300);
  check(hostState.started === true, "la partie démarre");
  check(hostState.players.filter(p => p.bot).length === 8, "8 IA comblent les nations vides");
  const germanTreasury = hostState.treasury[hostPid().id].money;
  check(germanTreasury >= (2000 * 2 + 5000) * 21, "triche : réserves ×2 + argent supplémentaire sur les provinces du créateur (trésor >= 189000)");

  const playerPid = () => playerState.players.find(p => p.name === "Joueur1");
  const frProv = playerState.provinces.find(p => p.id === "france_1");
  const moneyBefore = playerState.treasury[playerPid().id].money, foodBefore = playerState.treasury[playerPid().id].food;
  const infBefore = frProv.units.infantry;
  player.emit("recruit", { unit: "infantry", amount: 100, provinceId: "france_1" });
  await wait(300);
  const frAfter = playerState.provinces.find(p => p.id === "france_1");
  check(playerState.treasury[playerPid().id].money === moneyBefore - 300 && playerState.treasury[playerPid().id].food === foodBefore - 200, "recrutement de 100 infanteries déduit le coût du trésor national (300 argent, 200 nourriture)");
  check(frAfter.units.infantry === infBefore + 100, "les 100 infanteries apparaissent dans la province visée");

  player.emit("build", { building: "barracks", provinceId: "france_1" });
  await wait(300);
  check(playerState.provinces.find(p => p.id === "france_1").buildings.barracks === 2, "construction d'une deuxième caserne");

  const frWithBorder = playerState.provinces.find(p => p.owner === "france" && playerState.adjacency[p.id].some(t => playerState.provinces.find(q => q.id === t).owner !== "france"));
  check(!!frWithBorder, "la France possède au moins une province frontalière");
  const target = playerState.adjacency[frWithBorder.id].map(t => playerState.provinces.find(p => p.id === t)).filter(p => p.owner !== "france").sort((a, b) => a.units.infantry - b.units.infantry)[0];
  const defBefore = target.units.infantry;
  player.emit("attack", { from: frWithBorder.id, to: target.id, fraction: 0.8 });
  await wait(300);
  const after = playerState.provinces.find(p => p.id === target.id);
  const srcAfter = playerState.provinces.find(p => p.id === frWithBorder.id);
  const captured = after.owner === "france";
  check(captured || after.units.infantry < defBefore || srcAfter.units.infantry < frAfter.units.infantry, "le combat modifie la situation (capture, pertes ou engagement)");
  check(srcAfter && srcAfter.units.infantry < frWithBorder.units.infantry, "les unités attaquantes quittent la province de départ");

  player.emit("attack", { from: "france_1", to: "japan_21", fraction: 0.8 });
  const err1 = await waitFor(player, "errorMessage");
  check(typeof err1 === "string" && /adjacente/.test(err1), "attaque non adjacente refusée");

  const adminTarget = playerPid().id;
  const oilBefore = playerState.treasury[adminTarget].oil;
  host.emit("adminAction", { hostToken, kind: "resource", amount: 1000, targetId: adminTarget, resource: "oil" });
  await wait(300);
  check(playerState.treasury[adminTarget].oil >= oilBefore + 1000, "action de triche : pétrole ajouté au trésor du joueur cible");

  player.emit("adminAction", { hostToken: "faux", kind: "resource", amount: 1000, targetId: adminTarget, resource: "money" });
  const err2 = await waitFor(player, "errorMessage");
  check(!!err2, "un joueur non-créateur ne peut pas utiliser les commandes de triche");

  const host2 = io(URL, { transports: ["websocket"] });
  const created2 = new Promise(res => host2.once("created", res));
  host2.emit("createGame", { name: "Créateur2", cheats: false, settings: null });
  const { hostToken: token2 } = await created2;
  let state2 = null;
  host2.on("state", s => state2 = s);
  await wait(300);
  host2.emit("adminAction", { hostToken: token2, kind: "resource", amount: 999, targetId: host2.id, resource: "money" });
  const err3 = await waitFor(host2, "errorMessage");
  check(state2.cheats === false && !!err3, "triche désactivée à la création => commandes refusées");

  const host3 = io(URL, { transports: ["websocket"] });
  const created3 = new Promise(res => host3.once("created", res));
  host3.emit("createGame", { name: "Créateur3", cheats: true, settings: null });
  const { code: code3, hostToken: token3 } = await created3;
  let state3 = null;
  host3.on("state", s => state3 = s);
  host3.emit("chooseNation", { nationId: "usa" });
  await wait(300);
  host3.emit("startGame", { hostToken: token3, bots: true });
  await wait(300);
  const host3Pid = () => state3.players.find(p => p.name === "Créateur3");
  host3.emit("adminAction", { hostToken: token3, kind: "province", amount: 300, targetId: host3Pid().id });
  await wait(500);
  const usaProvinces = state3.provinces.filter(p => p.owner === "usa").length;
  check(usaProvinces === 210, "cheat 'province' : les 210 provinces sont transférées à la nation cible");
  check(state3.over === true && state3.winner === "États-Unis", "victoire détectée à 210 provinces (gagnant: États-Unis)");

  host.close(); player.close(); host2.close(); host3.close();
  console.log(failures === 0 ? "\nTOUS LES TESTS PASSENT" : `\n${failures} TEST(S) EN ÉCHEC`);
  setTimeout(() => process.exit(failures === 0 ? 0 : 1), 300);
}
main().catch(e => { console.error(e); process.exit(1); });
