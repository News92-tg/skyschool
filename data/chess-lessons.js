window.CHESS_LESSONS = [
  { id:'l01', title:{ru:'Как ходит каждая фигура',en:'How each piece moves'},
    fen:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    body:{ru:`Пешка идёт вперёд на одну клетку, со стартовой — на две. Бьёт по диагонали. Дойдя до последней горизонтали, превращается в любую фигуру (обычно в ферзя).\n\nКонь — буквой «Г»: две клетки в одном направлении, одна в перпендикулярном. Единственная фигура, которая перепрыгивает через других.\n\nСлон идёт по диагоналям. Живёт на своём цвете всю партию.\n\nЛадья идёт по горизонталям и вертикалям.\n\nФерзь — по диагоналям, горизонталям и вертикалям. Самая сильная фигура.\n\nКороль — на одну клетку в любом направлении. Рокировка: король на две клетки к ладье, ладья перепрыгивает. Только если ни один не двигался, между ними пусто, и король не под боем.`,
        en:`A pawn moves one square forward, two from its starting square. It captures diagonally. Reaching the last rank, it promotes.\n\nA knight moves in an L: two squares one way, one perpendicular. It jumps over other pieces.\n\nA bishop moves diagonally. It stays on its colour the whole game.\n\nA rook moves along files and ranks.\n\nA queen moves diagonally, horizontally and vertically.\n\nA king moves one square in any direction. Castling: the king goes two squares towards the rook and the rook jumps over. Only if neither has moved, the squares between are empty, and the king is not in check.`}},

  { id:'l02', title:{ru:'Цель игры и три исхода',en:'The goal and three outcomes'},
    body:{ru:`Цель — поставить мат королю соперника.\n\nМат — король под боем, и ни один ход не спасает.\n\nШах — король под боем, но есть выход.\n\nПат — ходить нечем, но шаха нет. Ничья, даже если у соперника ферзь и две ладьи.\n\nЕщё бывают ничьи: по трёхкратному повтору позиции, по правилу 50 ходов без взятий и движения пешек, при недостатке материала.`,
        en:`The goal is to checkmate the opponent's king.\n\nCheckmate — the king is attacked and no move saves it.\n\nCheck — the king is attacked but there is a way out.\n\nStalemate — no legal move, but no check either. A draw.\n\nOther draws: threefold repetition, the fifty-move rule, insufficient material.`}},

  { id:'l03', title:{ru:'Сколько стоит фигура',en:'What each piece is worth'},
    body:{ru:`Пешка — 1.\nКонь и слон — по 3.\nЛадья — 5.\nФерзь — 9.\nКороль бесценен.\n\nРазмен «конь за ладью» — выгодно (3 против 5). «Ладья за коня» — плохо. «Ферзь за две ладьи» — примерно равно.\n\nЭто грубая шкала, но она убережёт от восьмидесяти процентов грубых ошибок.`,
        en:`Pawn — 1.\nKnight and bishop — 3 each.\nRook — 5.\nQueen — 9.\nThe king is priceless.\n\nKnight for rook is good (3 vs 5). Rook for knight is bad. Queen for two rooks is roughly equal.`}},

  { id:'l04', title:{ru:'Вилка: одна фигура бьёт две',en:'The fork: one piece, two targets'},
    fen:'r3k2r/ppp2ppp/8/3N4/8/8/PPP2PPP/R3K2R w KQkq - 0 1',
    body:{ru:`Вилка — одна фигура атакует сразу две. Чаще всего это конь: он бьёт клетки, которые пешки не прикрывают.\n\nНа диаграмме конь на d5 бьёт ферзя (нет, там его нет) — смотрите позицию: конь с поля, откуда он атакует ладью и короля одновременно, гарантирует материал.\n\nОсобенно ценна вилка с шахом: король обязан ответить, и вы забираете вторую фигуру следующим ходом.`,
        en:`A fork attacks two things at once. Most often a knight, striking squares pawns do not defend.\n\nA fork with check is especially strong: the king must be dealt with first.`}},

  { id:'l05', title:{ru:'Связка: фигура не может уйти',en:'The pin'},
    fen:'rnbqkbnr/pppp1ppp/8/4p3/8/2N5/PPPP1PPP/R1BQKBNR b KQkq - 0 1',
    body:{ru:`Связка — фигура прикрывает собой что-то более ценное, и уйти не может.\n\nАбсолютная связка — с королём. Ходить этой фигурой нельзя: откроется шах.\n\nОтносительная — с ферзём или ладьёй. Формально можно, но за неё отдадут ферзя.\n\nКак использовать: раз фигура прикована, атакуйте её ещё раз. Считайте, сколько раз вы бьёте и сколько защищают.`,
        en:`A pin is a piece shielding something more valuable.\n\nAbsolute pin — against the king. That piece cannot move.\n\nRelative pin — against queen or rook.\n\nHow to use: knowing the piece is tied down, attack it again. Count attackers and defenders.`}},

  { id:'l06', title:{ru:'Сквозной удар',en:'The skewer'},
    body:{ru:`Сквозной удар — обратная связка. Вы бьёте самую ценную фигуру, она вынуждена отойти, а за ней стоит вторая, менее ценная, и её вы забираете.\n\nКлассика: шах королю ферзём, король уходит — ферзь или ладья берёт ладью за ним.\n\nПроще всего увидеть на одной линии с королём. Проверяйте диагонали, вертикали и горизонтали от короля — там часто прячется добыча.`,
        en:`A skewer is a pin in reverse. You attack the most valuable piece; it must move, and behind it is a lesser piece you take.\n\nEasiest to spot on a line with the king.`}},

  { id:'l07', title:{ru:'Двойной удар пешкой',en:'The pawn fork'},
    body:{ru:`Пешка — самая дешёвая фигура. Удар пешкой особенно обиден: она бьёт две фигуры, а сама защищена соседними пешками.\n\nПоставьте пешку на клетку, где она бьёт коня и слона или коня и ладью. Соперник уведёт одну — вторая останется.\n\nСильнее всего, когда пешка бьёт с шахом.\n\nПравило для защиты: перед каждым ходом смотрите, какие ваши фигуры стоят на клетках, которые бьют пешки соперника.`,
        en:`A pawn is the cheapest piece, and a pawn fork stings. Place a pawn where it hits two pieces — one will stay.\n\nDefence: before every move, look at which of your pieces sit on squares attacked by enemy pawns.`}},

  { id:'l08', title:{ru:'Как поставить мат в один ход',en:'How to mate in one'},
    fen:'6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
    body:{ru:`Мат в один — это ответ на вопрос «какая клетка рядом с королём не прикрыта и не занята?».\n\nСмотрите три вещи:\n1. Куда король может уйти? Эти клетки должны быть под боем или заняты своими фигурами.\n2. Может ли кто-то закрыть линию шаха? Тогда шах должен идти в упор.\n3. Можно ли съесть атакующую фигуру? Тогда она должна быть защищена.\n\nНа диаграмме — классический мат по последней линии. Ладья идёт на e8 и объявляет мат: пешки f7, g7, h7 закрывают отступление.`,
        en:`Mate in one answers: "which square near the king is neither guarded nor occupied?"\n\nOn the diagram — the classic back-rank mate: the rook goes to e8.`}},

  { id:'l09', title:{ru:'Три правила начала партии',en:'Three opening rules'},
    fen:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    body:{ru:`1. Займите центр. Пешки на e4 и d4 открывают дорогу слону и ферзю.\n2. Выведите лёгкие фигуры. Конь с g1 на f3, слон с f1 на c4.\n3. Рокируйте. Не позже седьмого-восьмого хода.\n\nНе выводите ферзя рано: его сразу начнут гнать. Не двигайте одну фигуру дважды без причины.`,
        en:`1. Take the centre.\n2. Develop the minor pieces.\n3. Castle. By move seven or eight.`}},

  { id:'l10', title:{ru:'Контроль центра',en:'Control of the centre'},
    fen:'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    body:{ru:`Четыре центральные клетки — d4, e4, d5, e5. Кто их контролирует, тот диктует игру.\n\nФигура в центре бьёт больше клеток. Конь на d4 видит восемь полей, на a1 — два.\n\nЦентр важен не тем, что там стоят пешки, а тем, что оттуда атакуют фигуры.`,
        en:`The four central squares are d4, e4, d5, e5. Whoever controls them dictates play.\n\nA piece in the centre attacks more squares.`}},

  { id:'l11', title:{ru:'Ловушки в дебюте',en:'Opening traps'},
    fen:'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 6 5',
    body:{ru:`Мат Легаля и «пастуший мат» — старейшие ловушки.\n\nПастуший мат: ферзь и слон бьют по f7. Работает, только если соперник не защитил эту пешку. Защита — конь f3, d6, рокировка.\n\nНа диаграмме — позиция, в которой белые ставят мат в один ход: Qxf7#.\n\nНе гонитесь за ловушками сами. Играйте нормальные ходы, и соперник подставится сам.`,
        en:`The Légal trap and Scholar's mate are the oldest tricks.\n\nOn the diagram, White mates in one: Qxf7#.`}},

  { id:'l13', title:{ru:'Открытое нападение',en:'Discovered attack'},
    body:{ru:`Вы уводите одну фигуру, и открывается линия для другой. Атакуют сразу две.\n\nСамая сильная форма — вскрытый шах. Вы объявляете шах, уходя фигурой, и это гарантирует темп: соперник обязан отвечать на шах, а вы делаете второй ход и забираете что-то ценное.\n\nКлассика: ладья стоит за слоном, слон смотрит на ферзя. Слон уходит с шахом — ладья бьёт ферзя.`,
        en:`Move one piece, open a line for another. Both attack.\n\nStrongest form is a discovered check. Classic: rook behind a bishop aiming at the queen. The bishop moves with check — the rook takes the queen.`}},

  { id:'l16', title:{ru:'Проходная пешка',en:'The passed pawn'},
    fen:'8/8/8/3P4/8/8/8/8 w - - 0 1',
    body:{ru:`Проходная — пешка, у которой на её вертикали и на соседних нет пешек соперника. Ей никто не мешает идти вперёд.\n\nПроходная в эндшпиле стоит больше фигуры. Пешка на седьмой горизонтали стоит почти как ферзь.\n\nСоздавайте проходные в эндшпиле. В миттельшпиле их надо поддерживать, а не гнать вперёд.`,
        en:`A passed pawn has no enemy pawns on its file or adjacent files.\n\nIn the endgame it is worth more than a piece. A pawn on the seventh rank is nearly a queen.`}},

  { id:'l19', title:{ru:'Как считать варианты',en:'How to calculate lines'},
    body:{ru:`Считайте только форсированные ходы: шахи, взятия, угрозы.\n\nПорядок:\n1. Какие у меня есть шахи?\n2. Какие есть взятия, особенно с шахом?\n3. Какие прямые угрозы я могу создать в один ход?\n\nСчитайте до «тихой» позиции, где нет шахов и взятий. Именно там вариант заканчивается.\n\nВсегда меняйтесь местами — вы противник на один ход.`,
        en:`Calculate only forcing moves: checks, captures, threats.\n\nGo down to a quiet position. Always swap sides — you are the opponent one move ahead.`}},

  { id:'l20', title:{ru:'Пешечная структура',en:'Pawn structure'},
    fen:'8/pp3ppp/8/8/8/8/PP3PPP/8 w - - 0 1',
    body:{ru:`Пешки не возвращаются назад. Каждый ход пешкой необратим.\n\nСдвоенные пешки: две на одной вертикали. Минус — не защищают друг друга. Плюс — открывают линию для ладьи.\n\nИзолированная пешка: нет соседей. В эндшпиле её легко атаковать.\n\nПрежде чем ходить пешкой, спросите: какую слабость я создаю?`,
        en:`Pawns never go back. Every pawn move is irreversible.\n\nBefore you move a pawn, ask: what weakness does this create?`}},

  { id:'l21', title:{ru:'Хороший и плохой слон',en:'Good bishop, bad bishop'},
    body:{ru:`Слон ходит по одному цвету всю партию. Если его собственные пешки стоят на этом цвете, он заперт — это плохой слон.\n\nСлон, чьи пешки стоят на другом цвете, свободен — это хороший слон.\n\nВ открытой позиции слон сильнее коня. В закрытой, с пешечными цепями, сильнее конь.`,
        en:`A bishop stays on one colour. If its own pawns sit on that colour, it is locked in.\n\nIn an open position a bishop is stronger; in a closed one, a knight.`}},

  { id:'l22', title:{ru:'Открытая линия и вторжение',en:'Open files and invasion'},
    body:{ru:`Открытая линия — вертикаль без пешек.\n\nЧто делать:\n1. Поставьте туда ладью.\n2. Сдвойте ладьи.\n3. Вторгнитесь на седьмую горизонталь — ладья там бьёт пешки и отрезает короля от центра.\n\nЕсли соперник открыл линию — занимайте её раньше, чем он спохватится.`,
        en:`An open file has no pawns. Put a rook there, double the rooks, invade the seventh rank.`}},

  { id:'l24', title:{ru:'Король и пешка против короля',en:'King and pawn vs king'},
    fen:'8/8/8/3K4/3P4/8/8/7k w - - 0 1',
    body:{ru:`Простое правило: если король защищающей стороны успевает встать на пути пешки — ничья. Если нет — пешка проходит в ферзи.\n\nПравило квадрата: нарисуйте квадрат от пешки до поля превращения. Если король успевает в него вступить — он догонит.\n\nВ эндшпиле король — сильная фигура. Он должен идти вперёд и прикрывать пешку.\n\nОппозиция: два короля на одной линии через клетку. Кто вынужден ходить — теряет оппозицию.`,
        en:`If the defending king gets in front of the pawn, it is a draw.\n\nRule of the square: from the pawn to its promotion square. If the king can step inside, it catches.\n\nOpposition: two kings on one line, one square apart.`}},

  { id:'l25', title:{ru:'Ладейный эндшпиль',en:'Rook endgames'},
    fen:'1K6/1P6/8/8/8/8/r7/7k w - - 0 1',
    body:{ru:`Ладейные окончания — самые частые в шахматах.\n\nГлавное правило: ладью ставьте позади проходной пешки. Своей — чтобы подталкивать. Чужой — чтобы атаковать сзади.\n\nПозиция Луцены (ладья и пешка против ладьи, пешка на седьмой) — выигрыш.\n\nПозиция Филидора (король защищающей стороны перед пешкой, ладья на третьей горизонтали) — ничья.\n\nВ ладейных окончаниях активность решает больше, чем пешка.`,
        en:`Rook endgames are the most common.\n\nMain rule: put the rook behind the passed pawn.\n\nLucena position — a win. Philidor position — a draw.`}},

  { id:'l26', title:{ru:'Типичные ошибки новичка',en:'Typical beginner mistakes'},
    body:{ru:`Десять ошибок, которые проигрывают партию чаще всего:\n\n1. Ранний выход ферзя.\n2. Отсутствие рокировки.\n3. Захват пешек в ущерб развитию.\n4. Повторные ходы одной фигурой.\n5. Движение крайних пешек без необходимости.\n6. Отсутствие счёта ответных ходов.\n7. Оставление фигуры под боем «на авось».\n8. Игра без плана.\n9. Страх разменов.\n10. Сдача партии, когда вы на фигуру меньше.\n\nУберёте эти десять — будете играть сильнее восьмидесяти процентов любителей.`,
        en:`Ten mistakes that lose games more than any others:\n\n1. Early queen. 2. No castling. 3. Pawn-grabbing. 4. Moving the same piece twice. 5. Pushing edge pawns. 6. Not counting replies. 7. Leaving a piece hanging. 8. Playing without a plan. 9. Fearing trades. 10. Resigning too early.`}}
];
