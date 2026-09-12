/* ============================================================
   Шахматные задачи. Формат:
   { id, type:'mate1'|'tactic'|'defence', fen, solutions:[SAN],
     title:{ru,en}, idea:{ru,en} }
   ============================================================ */
window.CHESS_PUZZLES = [

  /* ---- Мат в 1 по последней линии (ладья) ---- */
  { id:'p01', type:'mate1', fen:'6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
    solutions:['Re8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ладья бьёт по последней линии. Пешки f7,g7,h7 не дают королю выйти.',en:'Back-rank mate. The pawns trap the king.'} },

  { id:'p02', type:'mate1', fen:'6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
    solutions:['Ra8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Та же идея с другого фланга.',en:'The same idea from the other side.'} },

  { id:'p03', type:'mate1', fen:'6k1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1',
    solutions:['Rb8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ладья встаёт на b8 с шахом.',en:'Rook to b8 with check.'} },

  { id:'p04', type:'mate1', fen:'6k1/5ppp/8/8/8/8/5PPP/3RK3 w - - 0 1',
    solutions:['Rd8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Шах по 8-й линии.',en:'Check on the eighth rank.'} },

  { id:'p05', type:'mate1', fen:'6k1/5ppp/8/8/8/8/5PPP/2R1K3 w - - 0 1',
    solutions:['Rc8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Мат ладьёй по последней.',en:'Back-rank rook mate.'} },

  /* ---- Мат в 1 ферзём ---- */
  { id:'p06', type:'mate1', fen:'6k1/5ppp/8/8/8/8/5PPP/3QK3 w - - 0 1',
    solutions:['Qd8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ферзь бьёт по 8-й линии.',en:'Queen on the eighth rank.'} },

  { id:'p07', type:'mate1', fen:'6k1/5ppp/8/8/8/8/5PPP/2Q1K3 w - - 0 1',
    solutions:['Qc8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ферзь по последней линии.',en:'Queen on the back rank.'} },

  /* ---- Мат ферзём рядом с королём ---- */
  { id:'p08', type:'mate1', fen:'6k1/5ppp/8/8/8/5Q2/8/6K1 w - - 0 1',
    solutions:['Qf8#','Qa8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ферзь идёт на 8-ю с шахом.',en:'Queen to the back rank.'} },

  /* ---- Пастуший мат ---- */
  { id:'p09', type:'mate1', fen:'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 6 5',
    solutions:['Qxf7#'], title:{ru:'Пастуший мат',en:"Scholar's mate"},
    idea:{ru:'Ферзь бьёт f7 при поддержке слона c4.',en:'Queen takes f7, protected by the bishop.'} },

  /* ---- Мат конём ---- */
  { id:'p10', type:'mate1', fen:'6k1/5ppp/8/8/8/8/5PPP/3N2K1 w - - 0 1',
    solutions:['Ne7#','Nd8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Вариант мата с конём — редко, но встречается.',en:'Knight mate — rarer.'} },

  /* ---- Вилки конём ---- */
  { id:'p11', type:'tactic', fen:'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1',
    solutions:['Nc7+'], title:{ru:'Вилка',en:'Fork'},
    idea:{ru:'Конь бьёт короля и ладью. Король уйдёт — ладья потеряется.',en:'Knight forks king and rook.'} },

  { id:'p12', type:'tactic', fen:'4k3/8/2q5/3N4/8/8/8/4K3 w - - 0 1',
    solutions:['Nxc7+'], title:{ru:'Вилка с шахом',en:'Fork with check'},
    idea:{ru:'Конь берёт и даёт шах — ферзь недосягаем для защиты.',en:'Fork with check, queen is lost.'} },

  { id:'p13', type:'tactic', fen:'4k3/3q4/8/3N4/8/8/8/4K3 w - - 0 1',
    solutions:['Nc7+','Nf6+','Nf4+'], title:{ru:'Вилка',en:'Fork'},
    idea:{ru:'Конь бьёт короля и ферзя.',en:'Knight forks king and queen.'} },

  { id:'p14', type:'tactic', fen:'3rk3/8/3q4/3N4/8/8/8/4K3 w - - 0 1',
    solutions:['Nc7+'], title:{ru:'Двойной удар',en:'Double attack'},
    idea:{ru:'Конь бьёт короля и ладью.',en:'Knight hits king and rook.'} },

  { id:'p15', type:'tactic', fen:'r3k3/3q4/8/3N4/8/8/8/4K3 w - - 0 1',
    solutions:['Nc7+'], title:{ru:'Вилка',en:'Fork'},
    idea:{ru:'Конь с поля c7 бьёт короля и ладью.',en:'Fork on c7.'} },

  /* ---- Сквозные удары ---- */
  { id:'p16', type:'tactic', fen:'4k3/8/8/8/8/8/8/4KR2 w - - 0 1',
    solutions:['Rf8+'], title:{ru:'Сквозной удар',en:'Skewer'},
    idea:{ru:'Ладья на f8 даёт шах. Если король отойдёт — заберём фигуру за ним.',en:'Skewer with check.'} },

  /* ---- Связки ---- */
  { id:'p17', type:'tactic', fen:'4k3/4n3/8/4R3/8/8/8/4K3 w - - 0 1',
    solutions:['Rxe7+','Rxe7#'], title:{ru:'Связка',en:'Pin'},
    idea:{ru:'Ладья бьёт связанного коня с шахом.',en:'Rook takes the pinned knight.'} },

  { id:'p18', type:'tactic', fen:'4k3/8/4n3/4B3/8/8/8/4K3 w - - 0 1',
    solutions:['Bxe6'], title:{ru:'Связка',en:'Pin'},
    idea:{ru:'Конь на e6 прикрывает своего короля — слон забирает его.',en:'The knight blocks its own king — bishop takes it.'} },

  /* ---- Двойные удары ферзём ---- */
  { id:'p19', type:'tactic', fen:'4k3/8/8/8/8/8/8/3QK3 w - - 0 1',
    solutions:['Qd8+'], title:{ru:'Шах с выигрышем темпа',en:'Check with tempo'},
    idea:{ru:'Шах ферзём по последней линии.',en:'Queen check on the back rank.'} },

  { id:'p20', type:'tactic', fen:'r3k3/8/8/8/8/8/8/3QK3 w - - 0 1',
    solutions:['Qd8+','Qd1a1'], title:{ru:'Захват ладьи',en:'Win a rook'},
    idea:{ru:'Шах королю, а затем — ладья.',en:'Check, then the rook.'} },

  /* ---- Простые маты ферзём с поддержкой ---- */
  { id:'p21', type:'mate1', fen:'6k1/8/6K1/8/8/8/8/4Q3 w - - 0 1',
    solutions:['Qe8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Король белых прикрывает, ферзь бьёт на 8-ю.',en:'The king shields, the queen mates.'} },

  { id:'p22', type:'mate1', fen:'5k2/8/5K2/8/8/8/8/4Q3 w - - 0 1',
    solutions:['Qe8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ферзь бьёт по 8-й линии.',en:'Queen to the eighth.'} },

  { id:'p23', type:'mate1', fen:'7k/8/6K1/8/8/8/8/4Q3 w - - 0 1',
    solutions:['Qe8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ферзь по 8-й.',en:'Queen to e8.'} },

  /* ---- Защита: уйти от мата ---- */
  { id:'p24', type:'defence', fen:'6k1/5ppp/8/8/8/8/5PPP/4RK2 b - - 0 1',
    solutions:['h6'], title:{ru:'Защита от мата',en:'Defend against mate'},
    idea:{ru:'Чёрные должны создать «форточку» — ход h6 даёт королю поле h7.',en:'Make luft — h6 gives the king an escape square.'} },

  { id:'p25', type:'defence', fen:'6k1/5ppp/8/8/8/8/5PPP/2Q3K1 b - - 0 1',
    solutions:['h6','g6'], title:{ru:'Защита от мата',en:'Defend'},
    idea:{ru:'Создайте королю поле для отступления.',en:'Give the king room.'} },

  /* ---- Разные маты в 1 ---- */
  { id:'p26', type:'mate1', fen:'2k5/8/2K5/8/8/8/8/4Q3 w - - 0 1',
    solutions:['Qe8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ферзь по 8-й линии.',en:'Queen on the eighth.'} },

  { id:'p27', type:'mate1', fen:'k7/8/8/8/8/8/8/KR6 w - - 0 1',
    solutions:['Rb8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ладья по последней, король белых защищает.',en:'Back-rank mate.'} },

  { id:'p28', type:'mate1', fen:'k7/8/8/8/8/8/8/KQR5 w - - 0 1',
    solutions:['Qb7#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ферзь в упор, ладья не даёт королю уйти.',en:'Queen on b7, rook covers escape.'} },

  { id:'p29', type:'mate1', fen:'6k1/5p1p/6p1/8/8/8/5PPP/4R1K1 w - - 0 1',
    solutions:['Re8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'На 8-й линии мат, пешки закрыли отступление.',en:'Back-rank mate with pawn cover.'} },

  { id:'p30', type:'mate1', fen:'5k2/8/5K2/8/8/8/8/7R w - - 0 1',
    solutions:['Rh8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ладья по последней линии, король отрезает поля.',en:'Back-rank mate, king cuts off.'} },

  /* ---- Задачи на счёт ---- */
  { id:'p31', type:'tactic', fen:'4k3/8/8/8/8/8/4q3/4K3 b - - 0 1',
    solutions:['Qe2#','Qxe1#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Чёрные ставят мат ферзём.',en:'Black mates with the queen.'} },

  { id:'p32', type:'mate1', fen:'4k3/8/4K3/8/8/8/8/4Q3 w - - 0 1',
    solutions:['Qe7#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ферзь бьёт рядом с королём — мат.',en:'Queen mates next to the king.'} },

  { id:'p33', type:'mate1', fen:'3k4/8/3K4/8/8/8/8/4Q3 w - - 0 1',
    solutions:['Qe8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ферзь на 8-й, король белых отрезает поля.',en:'Queen on the eighth, king covers.'} },

  { id:'p34', type:'mate1', fen:'4k3/8/4K3/8/8/8/8/7R w - - 0 1',
    solutions:['Rh8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ладья по последней.',en:'Back-rank rook mate.'} },

  { id:'p35', type:'mate1', fen:'2k5/8/2K5/8/8/8/8/3R4 w - - 0 1',
    solutions:['Rd8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ладья с шахом, король отрезает.',en:'Rook checks, king covers.'} },

  /* ---- Пешечные вилки ---- */
  { id:'p36', type:'tactic', fen:'4k3/8/3q4/4P3/8/8/8/4K3 w - - 0 1',
    solutions:['exd6'], title:{ru:'Пешечный удар',en:'Pawn attack'},
    idea:{ru:'Пешка бьёт ферзя. Король далеко — не спасёт.',en:'Pawn takes the queen.'} },

  { id:'p37', type:'tactic', fen:'2k5/8/3q4/4P3/8/8/8/4K3 w - - 0 1',
    solutions:['exd6'], title:{ru:'Пешечный удар',en:'Pawn attack'},
    idea:{ru:'Пешка забирает ферзя.',en:'Pawn takes queen.'} },

  /* ---- Комбинации ---- */
  { id:'p38', type:'tactic', fen:'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
    solutions:['Rxa8+'], title:{ru:'Захват ладьи с шахом',en:'Capture with check'},
    idea:{ru:'Ладья бьёт ладью с шахом.',en:'Rook takes rook with check.'} },

  { id:'p39', type:'tactic', fen:'4k3/8/8/8/8/8/q7/R3K3 w Q - 0 1',
    solutions:['Rxa2'], title:{ru:'Защита ладьёй',en:'Save with the rook'},
    idea:{ru:'Ладья берёт ферзя.',en:'Rook takes the queen.'} },

  { id:'p40', type:'tactic', fen:'4k3/8/8/8/8/8/2q5/2RK4 w - - 0 1',
    solutions:['Rxc2'], title:{ru:'Захват ферзя',en:'Win the queen'},
    idea:{ru:'Ладья бьёт ферзя.',en:'Rook takes queen.'} },

  /* ---- Ещё маты ---- */
  { id:'p41', type:'mate1', fen:'7k/8/6K1/8/8/8/8/7R w - - 0 1',
    solutions:['Rh1h8#','Rh8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ладья по последней линии, король белых отрезает.',en:'Back-rank mate.'} },

  { id:'p42', type:'mate1', fen:'6k1/8/6K1/8/8/8/8/7R w - - 0 1',
    solutions:['Rh8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Классический мат ладьёй по последней.',en:'Classic back-rank.'} },

  { id:'p43', type:'mate1', fen:'6k1/8/5K2/8/8/8/8/7R w - - 0 1',
    solutions:['Rh8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ладья с шахом.',en:'Rook check.'} },

  { id:'p44', type:'mate1', fen:'5k2/8/5K2/8/8/8/8/8 w - - 0 1',
    solutions:['Ke6'], title:{ru:'Не мат — обманка',en:'Not a mate — trap'},
    idea:{ru:'Здесь мата нет. Это ловушка, чтобы вы не подставлялись.',en:'No mate here — a decoy.'} },

  /* ---- Ещё тактические ---- */
  { id:'p45', type:'tactic', fen:'r3k3/8/8/8/8/8/8/1R2K3 w - - 0 1',
    solutions:['Rb8+'], title:{ru:'Шах ладьёй',en:'Rook check'},
    idea:{ru:'Ладья на b8 с шахом.',en:'Rook to b8 with check.'} },

  { id:'p46', type:'tactic', fen:'r3k3/8/8/8/8/8/8/4KR2 w - - 0 1',
    solutions:['Rf8+'], title:{ru:'Шах ладьёй',en:'Rook check'},
    idea:{ru:'Ладья на f8 с шахом.',en:'Rook to f8 with check.'} },

  { id:'p47', type:'tactic', fen:'3rk3/8/8/8/8/8/8/3RK3 w - - 0 1',
    solutions:['Rxd8+'], title:{ru:'Размен ладей',en:'Trade rooks'},
    idea:{ru:'Ладья бьёт ладью с шахом.',en:'Rook takes rook with check.'} },

  { id:'p48', type:'mate1', fen:'4k3/8/8/8/8/8/6R1/6K1 w - - 0 1',
    solutions:['Re2#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ладья бьёт по вертикали с шахом.',en:'Rook checks along the file.'} },

  { id:'p49', type:'mate1', fen:'4k3/8/8/8/8/8/4R3/4K3 w - - 0 1',
    solutions:['Re2#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ладья по вертикали — мат.',en:'Rook mate along the file.'} },

  { id:'p50', type:'mate1', fen:'4k3/8/8/8/8/8/8/3RK3 w - - 0 1',
    solutions:['Rd8#'], title:{ru:'Мат в 1',en:'Mate in 1'},
    idea:{ru:'Ладья по 8-й линии.',en:'Back-rank rook mate.'} }
];
