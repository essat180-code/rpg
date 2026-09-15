const { Server } = require("socket.io");
const io = new Server(3000, { cors: { origin: "*" } });

const players = {};   // socketId -> {x,z,rot,hp,name,partyId,guildId}
const monsters = {};  // id -> {x,z,hp,type,state}
const boss = { hp: 1500, maxHp: 1500, phase: 1, x: -60, z: -60, alive: false };
const parties = {};   // partyId -> [socketId,...]
const guilds = {};    // guildId -> {members:[], chat:[]}

function spawnMonsters(n=16){
  for(let i=0;i<n;i++){
    const id = "m"+i;
    monsters[id] = { id, x:(Math.random()-0.5)*220, z:(Math.random()-0.5)*220,
      hp:40, maxHp:40, type:"wolf", state:"idle" };
  }
}
spawnMonsters();

io.on("connection", (socket) => {
  players[socket.id] = { x:0, z:0, rot:0, hp:100, maxHp:100, name:"Player"+socket.id.slice(0,4) };

  // 초기 상태 전송
  socket.emit("init", { id: socket.id, players, monsters, boss });
  socket.broadcast.emit("playerJoined", { id: socket.id, ...players[socket.id] });

  // 위치 갱신 (초당 여러 번, 서버는 그대로 브로드캐스트만)
  socket.on("move", (data) => {
    if(!players[socket.id]) return;
    Object.assign(players[socket.id], data); // {x,z,rot}
    socket.broadcast.emit("playerMoved", { id: socket.id, ...data });
  });

  // 공격 판정은 서버에서 (클라이언트 신뢰 X)
  socket.on("attackMonster", ({ monsterId, dmg }) => {
    const m = monsters[monsterId];
    if(!m || m.hp<=0) return;
    m.hp = Math.max(0, m.hp - dmg);
    io.emit("monsterHp", { id: monsterId, hp: m.hp });
    if(m.hp<=0){
      io.emit("monsterDied", { id: monsterId, killerId: socket.id });
      setTimeout(()=>{ m.hp = m.maxHp; io.emit("monsterRespawn", m); }, 14000);
    }
  });

  socket.on("attackBoss", ({ dmg }) => {
    if(!boss.alive) return;
    boss.hp = Math.max(0, boss.hp - dmg);
    const pct = boss.hp/boss.maxHp;
    let newPhase = boss.phase;
    if(pct<=0.66 && boss.phase===1) newPhase=2;
    if(pct<=0.33 && boss.phase===2) newPhase=3;
    if(newPhase!==boss.phase){ boss.phase=newPhase; io.emit("bossPhase", newPhase); }
    io.emit("bossHp", { hp: boss.hp, phase: boss.phase });
    if(boss.hp<=0){ boss.alive=false; io.emit("bossDefeated"); }
  });

  // 파티
  socket.on("createParty", () => {
    const partyId = "p_"+socket.id;
    parties[partyId] = [socket.id];
    players[socket.id].partyId = partyId;
    socket.emit("partyCreated", partyId);
  });
  socket.on("joinParty", (partyId) => {
    if(!parties[partyId]) return;
    parties[partyId].push(socket.id);
    players[socket.id].partyId = partyId;
    parties[partyId].forEach(pid => io.to(pid).emit("partyUpdate", parties[partyId]));
  });

  // 길드 채팅
  socket.on("guildChat", ({ guildId, msg }) => {
    const payload = { name: players[socket.id].name, msg, time: Date.now() };
    io.to(guildId).emit("guildChat", payload); // room 사용 시 socket.join(guildId) 필요
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});
