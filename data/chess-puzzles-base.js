/* ============================================================
   Шахматные задачи SkyySchool.
   Поля:
   - category: mate1 | mate2 | fork | pin | skewer | discovered |
               defence | endgame | opening | general
   - difficulty: easy | medium | hard
   ============================================================ */
window.CHESS_PUZZLES = [

  /* ============ MATE1 · ЛЁГКИЕ (мат в 1 ладьёй по последней) ============ */
  { id:'m1-001', category:'mate1', difficulty:'easy', fen:'6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', solutions:['Re8#'], title:{ru:'Мат в 1',en:'Mate in 1'}, idea:{ru:'Ладья по последней линии. Пешки не дают королю выйти.',en:'Back-rank mate.'} },
  { id:'m1-002', category:'mate1', difficulty:'easy', fen:'6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', solutions:['Ra8#'], title:{ru:'Мат в 1',en:'Mate in 1'}, idea:{ru:'Ладья встаёт на a8.',en:'Rook to a8.'} },
  { id:'m1-003', category:'mate1', difficulty:'easy', fen:'6k1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1', solutions:['Rb8#'], title:{ru:'Мат в 1',en:'Mate in 1'}, idea:{ru:'Ладья на b8.',en:'Rook to b8.'} },
  { id:'m1-004', category:'mate1', difficulty:'easy', fen:'6k1/5ppp/8/8/8/8/5PPP/2R1K3 w - - 0 1', solutions:['Rc8#'], title:{ru:'Мат в 1',en:'Mate in 1'}, idea:{ru:'Ладья по 8-й.',en:'Rook on the eighth.'} },
  { id:'m1-005', category:'mate1', difficulty:'easy', fen:'6k1/5ppp/8/8/8/8/5PPP/3RK3 w - - 0 1', solutions:['Rd8#'], title:{ru:'Мат в 1',en:'Mate in 1'}, idea:{ru:'Ладья на d8.',en:'Rook to d8.'} },
  { id:'m1-008', category:'mate1', difficulty:'easy', fen:'7k/6pp/8/8/8/8/6PP/R6K w - - 0 1', solutions:['Ra8#'], title:{ru:'Мат в 1',en:'Mate in 1'}, idea:{ru:'По последней линии.',en:'Back rank.'} },

  /* ============ MATE1 · ЛЁГКИЕ (мат ферзём) ============ */
  { id:'m1-010', category:'mate1', difficulty:'easy', fen:'6k1/5ppp/8/8/8/8/5PPP/3QK3 w - - 0 1', solutions:['Qd8#'], title:{ru:'Мат в 1',en:'Mate in 1'}, idea:{ru:'Ферзь по последней.',en:'Queen on the back rank.'} },
  { id:'m1-011', category:'mate1', difficulty:'easy', fen:'6k1/5ppp/8/8/8/8/5PPP/2Q1K3 w - - 0 1', solutions:['Qc8#'], title:{ru:'Мат в 1',en:'Mate in 1'}, idea:{ru:'Ферзь на c8.',en:'Queen to c8.'} },
  { id:'m1-012', category:'mate1', difficulty:'easy', fen:'6k1/5ppp/8/8/8/5Q2/8/6K1 w - - 0 1', solutions:['Qa8#'], title:{ru:'Мат в 1',en:'Mate in 1'}, idea:{ru:'Ферзь пробивает по 8-й.',en:'Queen strikes the eighth.'} },
  { id:'m1-015', category:'mate1', difficulty:'easy', fen:'2k5/8/2K5/8/8/8/8/4Q3 w - - 0 1', solutions:['Qe8#'], title:{ru:'Мат в 1',en:'Mate in 1'}, idea:{ru:'Ферзь по 8-й с шахом.',en:'Queen to e8 with check.'} },

  /* ============ MATE1 · СРЕДНИЕ (нужно найти форточку или обход) ============ */
  { id:'m1-030', category:'mate1', difficulty:'medium', fen:'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 6 5', solutions:['Qxf7#'], title:{ru:'Пастуший мат',en:"Scholar's mate"}, idea:{ru:'Ферзь бьёт f7 под защитой слона.',en:'Queen takes f7 protected by the bishop.'} },
  { id:'m1-032', category:'mate1', difficulty:'medium', fen:'5k2/8/5K2/8/8/8/8/7R w - - 0 1', solutions:['Rh8#'], title:{ru:'Мат в 1',en:'Mate in 1'}, idea:{ru:'Ладья по последней.',en:'Back-rank rook mate.'} },

  /* ============ MATE1 · ТЯЖЁЛЫЕ ============ */
  { id:'m1-051', category:'mate1', difficulty:'hard', fen:'2r3k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1', solutions:['Rxc8#'], title:{ru:'Мат в 1',en:'Mate in 1'}, idea:{ru:'Размен ладей ведёт к мату.',en:'Rook trade leads to mate.'} },

  /* ============ MATE2 · ЛЁГКИЕ ============ */

  /* ============ MATE2 · СРЕДНИЕ ============ */

  /* ============ FORK · ЛЁГКИЕ (вилки конём) ============ */
  { id:'fk-001', category:'fork', difficulty:'easy', fen:'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1', solutions:['Nc7+'], title:{ru:'Вилка',en:'Fork'}, idea:{ru:'Конь бьёт короля и ладью.',en:'Knight forks king and rook.'} },
  { id:'fk-003', category:'fork', difficulty:'easy', fen:'4k3/3q4/8/3N4/8/8/8/4K3 w - - 0 1', solutions:['Nc7+'], title:{ru:'Вилка',en:'Fork'}, idea:{ru:'Конь бьёт короля и ферзя.',en:'Fork king and queen.'} },
  { id:'fk-004', category:'fork', difficulty:'easy', fen:'3rk3/8/3q4/3N4/8/8/8/4K3 w - - 0 1', solutions:['Nc7+'], title:{ru:'Вилка',en:'Fork'}, idea:{ru:'Конь бьёт короля и ладью.',en:'Knight hits king and rook.'} },
  { id:'fk-005', category:'fork', difficulty:'easy', fen:'r3k3/3q4/8/3N4/8/8/8/4K3 w - - 0 1', solutions:['Nc7+'], title:{ru:'Вилка',en:'Fork'}, idea:{ru:'Конь с c7.',en:'Fork on c7.'} },

  /* ============ FORK · СРЕДНИЕ ============ */
  { id:'fk-011', category:'fork', difficulty:'medium', fen:'2r1k3/8/2q5/3N4/8/8/8/4K3 w - - 0 1', solutions:['Nc7+'], title:{ru:'Вилка',en:'Fork'}, idea:{ru:'Вилка на c7.',en:'Fork on c7.'} },
  { id:'fk-014', category:'fork', difficulty:'medium', fen:'4k3/7q/8/4N3/8/8/8/4K3 w - - 0 1', solutions:['Nf7'], title:{ru:'Вилка',en:'Fork'}, idea:{ru:'Конь бьёт ферзя.',en:'Knight forks the queen.'} },
  { id:'fk-015', category:'fork', difficulty:'medium', fen:'2q1k3/8/8/4N3/8/8/8/4K3 w - - 0 1', solutions:['Nc6+','Ng6+'], title:{ru:'Вилка',en:'Fork'}, idea:{ru:'Конь бьёт короля и ферзя.',en:'Fork king and queen.'} },

  /* ============ FORK · ТЯЖЁЛЫЕ ============ */

  /* ============ PIN · СРЕДНИЕ (связки) ============ */
  { id:'pin-001', category:'pin', difficulty:'medium', fen:'4k3/4n3/8/4R3/8/8/8/4K3 w - - 0 1', solutions:['Rxe7+','Rxe7#'], title:{ru:'Связка',en:'Pin'}, idea:{ru:'Ладья бьёт связанного коня.',en:'Rook takes the pinned knight.'} },
  { id:'pin-003', category:'pin', difficulty:'medium', fen:'3qk3/8/8/3R4/8/8/8/4K3 w - - 0 1', solutions:['Rxd8+','Rxd8#'], title:{ru:'Связка',en:'Pin'}, idea:{ru:'Ладья бьёт ферзя, связанного с королём.',en:'Rook takes the pinned queen.'} },
  { id:'pin-004', category:'pin', difficulty:'medium', fen:'4k3/8/8/8/4r3/8/4R3/4K3 w - - 0 1', solutions:['Rxe4+'], title:{ru:'Связка',en:'Pin'}, idea:{ru:'Ладья бьёт ладью с шахом.',en:'Rook takes rook with check.'} },

  /* ============ PIN · ТЯЖЁЛЫЕ ============ */
  { id:'pin-010', category:'pin', difficulty:'hard', fen:'3rk3/8/4b3/3R4/8/8/8/4K3 w - - 0 1', solutions:['Rxd8+'], title:{ru:'Связка',en:'Pin'}, idea:{ru:'Ладья берёт ладью с шахом.',en:'Rook takes the rook with check.'} },

  /* ============ SKEWER · СРЕДНИЕ (сквозные) ============ */
  { id:'sk-001', category:'skewer', difficulty:'medium', fen:'4k3/8/8/8/8/8/8/4KR2 w - - 0 1', solutions:['Rf8+'], title:{ru:'Сквозной',en:'Skewer'}, idea:{ru:'Ладья даёт шах, за королём стоит фигура.',en:'Rook checks along the eighth.'} },

  /* ============ SKEWER · ТЯЖЁЛЫЕ ============ */
  { id:'sk-010', category:'skewer', difficulty:'hard', fen:'4k2q/8/8/8/8/8/8/4KR2 w - - 0 1', solutions:['Rf8+'], title:{ru:'Сквозной',en:'Skewer'}, idea:{ru:'Ладья на f8 забирает ферзя.',en:'Rook takes the queen.'} },
  { id:'sk-011', category:'skewer', difficulty:'hard', fen:'4k3/q7/8/8/8/8/8/4K2R w - - 0 1', solutions:['Rh8+'], title:{ru:'Сквозной',en:'Skewer'}, idea:{ru:'Ладья берёт ферзя.',en:'Rook takes the queen.'} },

  /* ============ DISCOVERED · СРЕДНИЕ (открытое нападение) ============ */

  /* ============ DEFENCE · ЛЁГКИЕ (защита) ============ */
  { id:'df-001', category:'defence', difficulty:'easy', fen:'6k1/5ppp/8/8/8/8/5PPP/4RK2 b - - 0 1', solutions:['h6'], title:{ru:'Защита от мата',en:'Defend against mate'}, idea:{ru:'Форточка: h6 даёт королю поле h7.',en:'Make luft.'} },
  { id:'df-002', category:'defence', difficulty:'easy', fen:'6k1/5ppp/8/8/8/8/5PPP/2Q3K1 b - - 0 1', solutions:['h6','g6'], title:{ru:'Защита',en:'Defend'}, idea:{ru:'Открываем королю отступление.',en:'Give the king air.'} },
  { id:'df-003', category:'defence', difficulty:'easy', fen:'6k1/5p1p/6p1/8/8/8/5PPP/2Q3K1 b - - 0 1', solutions:['h5','h6'], title:{ru:'Защита',en:'Defend'}, idea:{ru:'Ещё одна форточка.',en:'Make an escape hatch.'} },
  { id:'df-004', category:'defence', difficulty:'easy', fen:'6k1/5ppp/8/8/8/8/5PPP/3Q2K1 b - - 0 1', solutions:['h6'], title:{ru:'Защита',en:'Defend'}, idea:{ru:'Королю нужен воздух.',en:'King needs air.'} },

  /* ============ DEFENCE · СРЕДНИЕ ============ */
  { id:'df-011', category:'defence', difficulty:'medium', fen:'6k1/pp3ppp/8/8/8/8/PP3PPP/4RK2 b - - 0 1', solutions:['h6','g6'], title:{ru:'Защита',en:'Defend'}, idea:{ru:'Открыть королю поле.',en:'Open a square for the king.'} },

  /* ============ ENDGAME · ЛЁГКИЕ (эндшпиль) ============ */
  { id:'eg-001', category:'endgame', difficulty:'easy', fen:'8/8/8/3K4/3P4/8/8/7k w - - 0 1', solutions:['Kc6','Ke6'], title:{ru:'Король вперёд',en:'King forward'}, idea:{ru:'В эндшпиле король работает.',en:'King works in the endgame.'} },
  { id:'eg-002', category:'endgame', difficulty:'easy', fen:'8/8/8/8/3P4/3K4/8/7k w - - 0 1', solutions:['Ke4','Kc4'], title:{ru:'Король вперёд',en:'King forward'}, idea:{ru:'Пешка впереди, король поддерживает.',en:'King supports the pawn.'} },
  { id:'eg-003', category:'endgame', difficulty:'easy', fen:'8/8/8/4K3/4P3/8/8/7k w - - 0 1', solutions:['Kd6','Kf6'], title:{ru:'Король вперёд',en:'King forward'}, idea:{ru:'Ведём пешку.',en:'Escort the pawn.'} },
  { id:'eg-004', category:'endgame', difficulty:'easy', fen:'7k/8/6KP/8/8/8/8/8 w - - 0 1', solutions:['Kf7'], title:{ru:'Прорыв',en:'Push'}, idea:{ru:'Пешка на седьмой — почти ферзь.',en:'Pawn on the seventh.'} },
  { id:'eg-005', category:'endgame', difficulty:'easy', fen:'8/8/8/4k3/4P3/4K3/8/8 w - - 0 1', solutions:['Ke2','Kd2'], title:{ru:'Оппозиция',en:'Opposition'}, idea:{ru:'Борьба за оппозицию.',en:'Fight for opposition.'} },

  /* ============ ENDGAME · СРЕДНИЕ ============ */
  { id:'eg-010', category:'endgame', difficulty:'medium', fen:'1K6/1P6/8/8/8/8/r7/7k w - - 0 1', solutions:['Kc7'], title:{ru:'Проходная',en:'Passed pawn'}, idea:{ru:'Король ведёт пешку в ферзи.',en:'King escorts the pawn.'} },

  /* ============ OPENING · ЛЁГКИЕ (дебют) ============ */
  { id:'op-001', category:'opening', difficulty:'easy', fen:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', solutions:['e4','d4','Nf3'], title:{ru:'Хороший первый ход',en:'Good first move'}, idea:{ru:'Занимаем центр или развиваем.',en:'Take the centre or develop.'} },
  { id:'op-002', category:'opening', difficulty:'easy', fen:'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 0 1', solutions:['d5','Nf6'], title:{ru:'Ответ чёрных',en:'Black reply'}, idea:{ru:'Контроль центра.',en:'Control the centre.'} },

  /* ============ OPENING · СРЕДНИЕ ============ */
  { id:'op-010', category:'opening', difficulty:'medium', fen:'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1', solutions:['Nf3','d4'], title:{ru:'Ход белых',en:'White to play'}, idea:{ru:'Развиваем или бьём в центре.',en:'Develop or strike the centre.'} },

  /* ============ GENERAL · ЛЁГКИЕ ============ */
  { id:'gn-001', category:'general', difficulty:'easy', fen:'4k3/8/8/8/8/8/8/4K1R1 w - - 0 1', solutions:['Rg8+'], title:{ru:'Шах ладьёй',en:'Rook check'}, idea:{ru:'Ладья по последней линии.',en:'Rook along the eighth.'} },
  { id:'gn-002', category:'general', difficulty:'easy', fen:'4k3/8/8/8/8/8/8/4KQ2 w - - 0 1', solutions:['Qf8+'], title:{ru:'Шах ферзём',en:'Queen check'}, idea:{ru:'Ферзь бьёт по 8-й.',en:'Queen on the eighth.'} },
  { id:'gn-003', category:'general', difficulty:'easy', fen:'3k4/8/8/8/8/8/8/3KQ3 w - - 0 1', solutions:['Qe8+'], title:{ru:'Шах ферзём',en:'Queen check'}, idea:{ru:'Ферзь даёт шах.',en:'Queen check.'} },
  { id:'gn-004', category:'general', difficulty:'easy', fen:'4k3/8/8/8/8/8/8/R3K3 w - - 0 1', solutions:['Ra8+'], title:{ru:'Шах ладьёй',en:'Rook check'}, idea:{ru:'Ладья по 8-й.',en:'Rook along the eighth.'} },
  { id:'gn-005', category:'general', difficulty:'easy', fen:'4k3/8/4K3/8/8/8/8/7R w - - 0 1', solutions:['Rh8#'], title:{ru:'Мат ладьёй',en:'Rook mate'}, idea:{ru:'Классический мат по 8-й.',en:'Classic back-rank mate.'} },
  { id:'gn-010', category:'general', difficulty:'easy', fen:'k7/8/1K6/8/8/8/8/8 w - - 0 1', solutions:['Ka6','Kc6'], title:{ru:'Ход короля',en:'King move'}, idea:{ru:'Ведём короля.',en:'Approach with the king.'} },

  /* ============ GENERAL · СРЕДНИЕ ============ */
  { id:'gn-020', category:'general', difficulty:'medium', fen:'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', solutions:['Rxa8+','Rxa8#'], title:{ru:'Размен',en:'Trade'}, idea:{ru:'Забираем ладью.',en:'Take the rook.'} },
  { id:'gn-021', category:'general', difficulty:'medium', fen:'r3k3/8/8/8/8/8/8/R3K3 w Q - 0 1', solutions:['Rxa8+'], title:{ru:'Забираем ладью',en:'Take the rook'}, idea:{ru:'Ладья с шахом.',en:'Rook check.'} },
  { id:'gn-022', category:'general', difficulty:'medium', fen:'r3k3/8/8/8/8/8/8/4KR2 w - - 0 1', solutions:['Rf8+'], title:{ru:'Шах ладьёй',en:'Rook check'}, idea:{ru:'Ладья по 8-й.',en:'Rook on the eighth.'} },
  { id:'gn-023', category:'general', difficulty:'medium', fen:'3rk3/8/8/8/8/8/8/3RK3 w - - 0 1', solutions:['Rxd8+'], title:{ru:'Размен ладей',en:'Rook trade'}, idea:{ru:'Ладья за ладью с шахом.',en:'Rook takes rook with check.'} },
  { id:'gn-024', category:'general', difficulty:'medium', fen:'4k3/3q4/8/8/8/8/8/4KQ2 w - - 0 1', solutions:['Qe2+'], title:{ru:'Шах ферзём',en:'Queen check'}, idea:{ru:'Ферзь бьёт рядом.',en:'Queen close check.'} },

  /* ============ GENERAL · ТЯЖЁЛЫЕ ============ */
  { id:'gn-040', category:'general', difficulty:'hard', fen:'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5', solutions:['Bxf7+'], title:{ru:'Жертва слона',en:'Bishop sacrifice'}, idea:{ru:'Атака на f7.',en:'Attack on f7.'} },
  { id:'gn-042', category:'general', difficulty:'hard', fen:'4k3/8/8/8/8/8/4B3/4K2R w K - 0 1', solutions:['Rh8+'], title:{ru:'Шах ладьёй',en:'Rook check'}, idea:{ru:'Ладья бьёт по 8-й.',en:'Rook on the eighth.'} },
  { id:'gn-043', category:'general', difficulty:'hard', fen:'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', solutions:['Rxa8+','Rxa8#'], title:{ru:'Захват ладьи',en:'Take rook'}, idea:{ru:'Ладья бьёт ладью с шахом.',en:'Rook takes rook with check.'} },

  /* ============ ЗАЩИТА · ТЯЖЁЛЫЕ ============ */

  /* ============ ENDGAME · ТЯЖЁЛЫЕ ============ */
  { id:'eg-020', category:'endgame', difficulty:'hard', fen:'8/8/8/8/8/8/p7/K1k5 b - - 0 1', solutions:['Kc2'], title:{ru:'Пешка идёт в ферзи',en:'Pawn promotes'}, idea:{ru:'Не мешаем пешке.',en:'Let the pawn promote.'} },
  { id:'eg-021', category:'endgame', difficulty:'hard', fen:'8/8/8/8/8/5k2/5p2/5K2 b - - 0 1', solutions:['Ke3'], title:{ru:'Оппозиция',en:'Opposition'}, idea:{ru:'Забираем оппозицию.',en:'Take the opposition.'} },

];
