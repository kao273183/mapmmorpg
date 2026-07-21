// ---------- dungeon room data (v0.26 D1) ----------
const DUNGEON_ROOM_DEFS = {
  safe: {
    name:'安全戰鬥', short:'戰鬥', threat:1, score:1, color:'#7dffd6', icon:'⚔',
    desc:'標準怪物配置，適合穩定累積經驗。', rewards:['經驗', '一般掉落']
  },
  elite: {
    name:'菁英獵殺', short:'菁英', threat:2, score:2, color:'#d9a8ff', icon:'◆',
    desc:'怪物較少，但保證出現兩名強化菁英。', rewards:['裝備', '強化石']
  },
  treasure: {
    name:'寶藏房', short:'寶藏', threat:1, score:1, color:'#ffd36a', icon:'▣',
    desc:'少量守衛看守旅行者寶箱。', rewards:['精良裝備', '附魔塵']
  },
  event: {
    name:'事件房', short:'事件', threat:2, score:1, color:'#ff9f7a', icon:'?',
    desc:'祭壇或封印試煉，進房後可查看完整代價。', rewards:['祝福', '稀有獎勵']
  },
  camp: {
    name:'休整營地', short:'營地', threat:0, score:0, color:'#8aa8ff', icon:'✚',
    desc:'沒有敵人，立即回復 25% HP 與 MP。', rewards:['回復']
  },
  boss: {
    name:'首領房', short:'BOSS', threat:3, score:0, color:'#ff6b6b', icon:'☠',
    desc:'章節最終首領，擊敗後可撤退或繼續深入。', rewards:['Boss 裝備', '章節寶箱']
  }
};

const DUNGEON_ROUTE_WEIGHTS = {
  safe:4,
  elite:3,
  treasure:2,
  event:2,
  camp:1
};
