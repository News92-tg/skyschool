/* Шахматные задачи. Каждая проверена движком:
   маты действительно маты, тактика действительно выигрывает материал.
   type: 'mate1' | 'mate2' | 'tactic'
   solutions — все ходы, которые засчитываются как решение
   (иногда правильных продолжений несколько, и требовать ровно
   один — значит наказывать за верную идею). */
window.CHESS_PUZZLES = [
  { id:'z1', type:'mate1', level:1,
    fen:'6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', solutions:['Ra8#'],
    title:{ru:'Мат по последней горизонтали',en:'Back-rank mate'},
    idea:{ru:'Король заперт собственными пешками. Ладья заходит на восьмую горизонталь — уйти некуда.',
           en:'The king is boxed in by its own pawns. The rook lands on the back rank and there is no escape.'} },

  { id:'z2', type:'mate1', level:1,
    fen:'6k1/8/6K1/8/8/8/8/1Q6 w - - 0 1', solutions:['Qb8#'],
    title:{ru:'Мат ферзём при поддержке короля',en:'Queen mate with the king'},
    idea:{ru:'Свой король отнимает у чёрного короля поля f7, g7 и h7, ферзю остаётся закрыть восьмую горизонталь.',
           en:'Your king covers f7, g7 and h7; the queen only has to seal the back rank.'} },

  { id:'z3', type:'mate1', level:1,
    fen:'7k/8/5KQ1/8/8/8/8/8 w - - 0 1', solutions:['Qg7#'],
    title:{ru:'Ферзь вплотную к королю',en:'Queen right next to the king'},
    idea:{ru:'Ферзь встаёт рядом с чёрным королём — и не под боем, потому что его защищает свой король. Без этой поддержки ферзя просто съели бы.',
           en:'The queen steps right beside the black king, safe because your own king defends her. Without that support she would simply be taken.'} },

  { id:'z4', type:'mate1', level:2,
    fen:'6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', solutions:['Nf7#'],
    title:{ru:'Конь ставит мат',en:'Knight delivers mate'},
    idea:{ru:'Король полностью закрыт своими же фигурами. Конь бьёт единственное свободное поле, и снять его нечем.',
           en:'The king is walled in by its own pieces. The knight covers the only free square and nothing can take it.'} },

  { id:'z5', type:'mate1', level:2,
    fen:'7k/R7/1R6/8/8/8/8/7K w - - 0 1', solutions:['Rb8#'],
    title:{ru:'Мат двумя ладьями',en:'Mate with two rooks'},
    idea:{ru:'Одна ладья отрезает горизонталь, вторая ставит мат и защищена первой. Это «лесенка» — базовый приём эндшпиля.',
           en:'One rook cuts off the rank, the other mates and is defended by the first. This is the rook "ladder".'} },

  { id:'z6', type:'mate1', level:2,
    fen:'3r2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', solutions:['Rd1#'],
    title:{ru:'Та же ловушка, но за чёрных',en:'The same trap, playing Black'},
    idea:{ru:'Белые не сделали «форточку» своим пешкам — и получили мат по первой горизонтали. Ход h3 или g3 вовремя спас бы партию.',
           en:'White never made luft for the king and got mated on the first rank. A timely h3 or g3 would have saved the game.'} },

  { id:'z7', type:'tactic', level:2,
    fen:'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1', solutions:['Nc7+'],
    title:{ru:'Вилка конём',en:'Knight fork'},
    idea:{ru:'Конь нападает сразу на короля и на ладью. Король обязан уйти от шаха — и ладья теряется.',
           en:'The knight attacks the king and the rook at once. The king must move, and the rook falls.'} },

  { id:'z8', type:'tactic', level:1,
    fen:'4k3/8/8/3q4/4B3/8/8/4K3 w - - 0 1', solutions:['Bxd5'],
    title:{ru:'Ферзь под боем',en:'The queen is hanging'},
    idea:{ru:'Перед каждым своим ходом полезно спрашивать: что соперник оставил без защиты? Здесь — ферзя.',
           en:'Before every move ask what the opponent left undefended. Here it is the queen.'} },

  { id:'z9', type:'tactic', level:1,
    fen:'1r6/P6k/8/8/8/8/8/K7 w - - 0 1', solutions:['axb8=Q'],
    title:{ru:'Превращение со взятием',en:'Promotion with a capture'},
    idea:{ru:'Пешка бьёт ладью и тут же превращается в ферзя — два выигрыша одним ходом. Превратить можно в любую фигуру, кроме короля.',
           en:'The pawn takes the rook and promotes in the same move — two gains at once. You may promote to any piece except a king.'} },

  { id:'z10', type:'defence', level:3,
    fen:'3r2k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1', solutions:['h3','g3','h4','g4','Kf1'],
    title:{ru:'Не дайте поставить себе мат',en:'Stop the mate against you'},
    idea:{ru:'Чёрные грозят Лd1 с матом по первой горизонтали. Нужно заранее сделать «форточку» — сдвинуть пешку g или h, чтобы королю было куда уйти. Засчитывается любой такой ход — а также Kpf1, король тоже открывает себе выход.',
           en:'Black threatens Rd1 with a back-rank mate. Make luft in advance — push the g- or h-pawn so the king has a square. Any of those counts — and so does Kf1, which frees the king the same way.'} },

  { id:'z11', type:'mate1', level:3,
    fen:'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4', solutions:['Qxf7#'],
    title:{ru:'Детский мат',en:'Scholar’s mate'},
    idea:{ru:'Ферзь и слон бьют пункт f7 — самое слабое поле в начальной позиции, его защищает только король. Знать эту ловушку нужно с обеих сторон.',
           en:'Queen and bishop hit f7, the weakest square in the opening — defended only by the king. Know this trap from both sides.'} },

  { id:'z12', type:'tactic', level:3,
    fen:'4k3/8/8/8/8/8/4q3/4R1K1 w - - 0 1', solutions:['Rxe2'],
    title:{ru:'Связка: ферзю некуда деться',en:'A pin: the queen cannot leave'},
    idea:{ru:'Ферзь стоит на одной линии со своим королём и ладьёй белых. Уйти он не может — за ним король, поэтому его просто забирают.',
           en:'The queen stands on one line between her own king and the white rook. She cannot leave, so she is simply taken.'} }
];
