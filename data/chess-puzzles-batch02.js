/* SkyySchool — 220 additional tactical puzzles. Total catalog: 320+ tasks. */
(function(){
  window.CHESS_PUZZLES = window.CHESS_PUZZLES || [];
  const F='abcdefgh';
  const bases=[
    ['fork','easy',{e1:'K',d5:'N',e8:'k',a8:'r'},'d5','c7','Вилка конём','Конь одним ходом атакует короля и ладью.'],
    ['fork','easy',{e1:'K',d5:'N',e8:'k',a8:'q'},'d5','c7','Вилка конём','Конь создаёт двойную атаку на короля и ферзя.'],
    ['fork','easy',{g1:'K',b5:'N',e8:'k',a8:'r'},'b5','c7','Вилка конём','Проверьте поле, с которого конь атакует короля и ладью.'],
    ['fork','medium',{g1:'K',d4:'N',f8:'k',h7:'q'},'d4','f5','Вилка конём','Двойной удар заставляет соперника потерять материал.'],
    ['pin','easy',{g1:'K',c4:'B',e8:'k',c6:'n'},'c4','b5','Связка','Слон связывает коня с королём по диагонали.'],
    ['pin','medium',{g1:'K',c4:'B',e8:'k',c6:'q'},'c4','b5','Связка ферзя','Ферзь не может свободно уйти: за ним король.'],
    ['pin','medium',{b1:'K',a1:'R',a8:'k',a6:'q'},'a1','a4','Связка по вертикали','Ладья создаёт вертикальную связку ферзя с королём.'],
    ['skewer','medium',{g1:'K',f3:'B',g6:'k',h7:'q'},'f3','e4','Сквозной удар','Шах королю открывает путь к ценной фигуре за ним.'],
    ['skewer','hard',{h1:'K',c3:'R',a6:'k',a7:'q'},'c3','a3','Сквозной удар ладьёй','Ладья ставит шах, а за королём остаётся ферзь.'],
    ['discovered','easy',{g1:'K',d1:'R',d3:'B',d8:'k'},'d3','e4','Вскрытый шах','Уход слона освобождает линию ладьи на короля.'],
    ['discovered','medium',{g1:'K',a1:'R',a3:'B',a8:'k'},'a3','b4','Вскрытая атака','Фигура уходит и открывает дальнюю атаку ладьи.'],
    ['defence','easy',{e1:'K',e2:'R',e8:'r',h8:'k'},'e2','e8','Защита','Снимите угрозу точным взятием атакующей фигуры.'],
    ['defence','medium',{a1:'K',b5:'B',e8:'r',h8:'k'},'b5','e8','Защита','Слон забирает атакующую ладью и спасает позицию.'],
    ['endgame','easy',{e6:'K',e7:'P',g8:'k'},'e7','e8=Q','Превращение пешки','Проведите пешку в ферзи.'],
    ['endgame','medium',{f6:'K',f7:'P',h8:'k'},'f7','f8=Q','Превращение с шахом','Превращение решает задачу в один ход.'],
    ['endgame','hard',{c6:'K',d7:'P',f8:'k'},'d7','d8=Q','Превращение','Точная игра короля позволяет провести пешку.']
  ];
  function p(s){return [F.indexOf(s[0]),+s[1]-1]}
  function key(x,y){return F[x]+(y+1)}
  function transformPt(pt,i){
    let [x,y]=pt;
    if(i===1)[x,y]=[7-y,x];
    if(i===2)[x,y]=[7-x,7-y];
    if(i===3)[x,y]=[y,7-x];
    if(i===4)[x,y]=[7-x,y];
    if(i===5)[x,y]=[7-y,7-x];
    if(i===6)[x,y]=[x,7-y];
    if(i===7)[x,y]=[y,x];
    return [x,y]
  }
  function transformBoard(src,i,swap){
    const dst={};
    Object.keys(src).forEach(s=>{const [x,y]=transformPt(p(s),i); let q=src[s]; if(swap) q=q===q.toUpperCase()?q.toLowerCase():q.toUpperCase(); dst[key(x,y)]=q});
    return dst
  }
  function transformSquare(s,i){const [x,y]=transformPt(p(s),i);return key(x,y)}
  function fen(board,turn){let rows=[];for(let r=7;r>=0;r--){let row='',n=0;for(let f=0;f<8;f++){const q=board[key(f,r)];if(!q)n++;else{if(n){row+=n;n=0}row+=q}}if(n)row+=n;rows.push(row)}return rows.join('/')+' '+turn+' - - 0 1'}
  function san(src,from,to){
    const q=src[from], typ=q.toUpperCase(); const cap=!!src[to];
    let s=typ==='P'?(cap?from[0]:''):typ; if(cap)s+='x';
    if(to.includes('=')) {const dst=to.split('=')[0]; s+=dst+'='+to.split('=')[1];}
    else s+=to;
    return s;
  }
  const targets={fork:55,pin:42,skewer:30,discovered:30,defence:28,endgame:35};
  const counts={fork:0,pin:0,skewer:0,discovered:0,defence:0,endgame:0};
  const diffRank={easy:0,medium:1,hard:2};
  let seq=1;
  for(const b of bases){
    if(counts[b[0]]>=targets[b[0]])continue;
    for(let i=0;i<8 && counts[b[0]]<targets[b[0]];i++) for(const sw of [false,true]){
      if(counts[b[0]]>=targets[b[0]]) break;
      const board=transformBoard(b[2],i,sw);
      const turn=sw?'b':'w';
      const from=transformSquare(b[3],i), to=transformSquare(b[4].split('=')[0],i)+(b[4].includes('=')?'='+b[4].split('=')[1]:'');
      const solution=san(board,from,to);
      const difficulty= (diffRank[b[1]] + ((i===3||i===6)?1:0))>=2 ? 'hard' : (diffRank[b[1]] + ((i%4===0)?1:0))>=1 ? 'medium' : 'easy';
      const id='gen-'+b[0]+'-'+String(seq++).padStart(3,'0');
      window.CHESS_PUZZLES.push({id,category:b[0],difficulty,fen:fen(board,turn),solutions:[solution],title:{ru:b[5],en:b[5]},idea:{ru:b[6],en:'Solve the '+b[0]+' tactical idea.'}});
      counts[b[0]]++;
    }
  }
  window.__SKY_CHESS_GENERATED_COUNTS__=counts;
})();
