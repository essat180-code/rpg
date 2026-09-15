const socket = io("https://your-server-url.com");
const otherPlayers = {}; // id -> THREE.Group

socket.on("init", (data) => {
  Object.entries(data.players).forEach(([id, p]) => {
    if(id !== socket.id) addRemotePlayer(id, p);
  });
  // 몬스터/보스는 서버 데이터로 초기화
});

socket.on("playerMoved", ({id, x, z, rot}) => {
  const p = otherPlayers[id];
  if(p){ p.position.set(x,0,z); p.rotation.y = rot; }
});

socket.on("monsterHp", ({id, hp}) => { /* 로컬 몬스터 hp바 갱신 */ });
socket.on("bossPhase", (phase) => { /* 페이즈 연출 트리거 */ });

// 내 이동을 초당 10회 정도만 전송 (너무 자주 보내면 서버 부하)
setInterval(() => {
  socket.emit("move", { x: player.group.position.x, z: player.group.position.z, rot: player.group.rotation.y });
}, 100);

// 공격 시 서버에 판정 요청 (로컬에서 즉시 애니메이션은 보여주고, 데미지는 서버 응답으로 확정)
function tryPlayerAttack(){
  // ...로컬 애니메이션...
  monsters.forEach(m => {
    if(dist2D(player.group.position, m.group.position) <= player.attackRange){
      socket.emit("attackMonster", { monsterId: m.id, dmg: player.dmg });
    }
  });
}
