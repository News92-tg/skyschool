/* ============================================================
   Уроки шахмат — от нуля до уверенного клубного уровня.
   Каждый урок — одна мысль. Где нужно, приложена позиция (FEN).
   ============================================================ */
window.CHESS_LESSONS = [

  /* ---------- ОСНОВЫ ---------- */
  {
    id: 'l01',
    title: { ru: 'Как ходит каждая фигура', en: 'How each piece moves' },
    body: { ru:
`Пешка идёт вперёд на одну клетку, со стартовой — на две. Бьёт по диагонали. Дойдя до последней горизонтали, превращается в любую фигуру (обычно в ферзя).

Конь — буквой «Г»: две клетки в одном направлении, одна в перпендикулярном. Единственная фигура, которая перепрыгивает через других.

Слон идёт по диагоналям на любое расстояние. Живёт на своём цвете всю партию.

Ладья идёт по горизонталям и вертикалям на любое расстояние.

Ферзь — по диагоналям, горизонталям и вертикалям. Самая сильная фигура.

Король — на одну клетку в любом направлении. Всё остальное — забота о его безопасности.

Рокировка: король идёт на две клетки к ладье, ладья перепрыгивает на соседнюю. Разрешена, если оба не двигались, между ними пусто и король не под боем ни на одной из трёх клеток.`,
      en: `A pawn moves forward one square, two from its starting square. It captures diagonally. Reaching the last rank, it promotes to any piece (usually a queen).

A knight moves in an L: two squares one way, one square perpendicular. It is the only piece that jumps over others.

A bishop moves diagonally any distance. It stays on its own colour for the whole game.

A rook moves along files and ranks any distance.

A queen moves diagonally, horizontally and vertically. The strongest piece.

A king moves one square in any direction. Keeping it safe is everything else's job.

Castling: the king goes two squares towards the rook and the rook jumps over. Allowed if neither has moved, the squares between are empty, and the king is not in check on any of the three squares.` }
  },

  {
    id: 'l02',
    title: { ru: 'Цель игры и три исхода', en: 'The goal and three outcomes' },
    body: { ru:
`Цель — поставить мат королю соперника.

Мат — король под боем, и ни один ход не спасает: нельзя уйти, нельзя закрыть линию атаки, нельзя съесть атакующую фигуру.

Шах — король под боем, но есть выход. От шаха нужно избавиться обязательно и немедленно.

Пат — ходить нечем, но шаха нет. Ничья, даже если у соперника ферзь и две ладьи.

Ещё бывают ничьи: по трёхкратному повтору позиции, по правилу 50 ходов без взятий и без движения пешек, при недостатке материала (например, король против короля).

Не «съесть все фигуры», а «поставить мат» — вот к чему стремится вся партия.`,
      en: `The goal is to checkmate the opponent's king.

Checkmate — the king is attacked and no move saves it: it cannot escape, the line cannot be blocked, and the attacker cannot be captured.

Check — the king is attacked but there is a way out. A check must be dealt with immediately.

Stalemate — no legal move, but no check either. A draw, even if the opponent has a queen and two rooks.

Other draws: threefold repetition, the fifty-move rule without captures or pawn moves, and insufficient material (e.g. king against king).

Not "capture everything", but "give mate" — that is what the whole game aims at.` }
  },

  {
    id: 'l03',
    title: { ru: 'Сколько стоит фигура', en: 'What each piece is worth' },
    body: { ru:
`Пешка — 1.
Конь и слон — по 3 (лёгкие фигуры).
Ладья — 5.
Ферзь — 9.
Король бесценен.

Отсюда простое правило: размен «конь за ладью» — выгодно (3 против 5), «ферзь за две ладьи» — примерно равно (9 против 10), «ладья за коня» — плохо (5 против 3).

Это грубая шкала, и она не всегда права. Иногда слон в открытой позиции сильнее ладьи, если тот владеет всей доской. Иногда сдвоенные пешки стоят целой фигуры. Но на первых порах правило «считать материал» убережёт от восьмидесяти процентов грубых ошибок.`,
      en: `Pawn — 1.
Knight and bishop — 3 each (the minor pieces).
Rook — 5.
Queen — 9.
The king is priceless.

Hence a simple rule: trading a knight for a rook is good (3 against 5); a queen for two rooks is roughly equal (9 against 10); a rook for a knight is bad (5 against 3).

It is a rough scale and it is not always right. Sometimes a bishop in an open position is stronger than a rook if it controls the whole board. Sometimes doubled pawns cost a whole piece. But early on, counting material will save you from eighty percent of gross blunders.` }
  },

  {
    id: 'l04',
    title: { ru: 'Как выиграть материал: вилка', en: 'Winning material: the fork' },
    body: { ru:
`Вилка — одна фигура бьёт две сразу. Чаще всего это конь: он атакует клетки, которые пешки не прикрывают, и его трудно прогнать.

Схема: найдите клетку, с которой конь бьёт ферзя и ладью одновременно. Соперник спасёт одну фигуру — вторая останется вам.

Особенно ценна вилка с шахом: король обязан ответить, и вы забираете вторую фигуру следующим ходом.

Также вилкуют ферзь и ладья, но у них меньше подходящих клеток, и соперник видит угрозу раньше.`,
      en: `A fork attacks two things at once. Most often it is a knight: it strikes squares pawns do not defend, and it is hard to drive off.

Method: find a square from which the knight attacks the queen and a rook at the same time. Your opponent saves one piece; the other is yours.

A fork with check is especially strong: the king must be dealt with first, and you take the second piece next move.

Queens and rooks fork too, but they have fewer suitable squares and the threat is seen earlier.` }
  },

  {
    id: 'l05',
    title: { ru: 'Связка: фигура не может уйти', en: 'The pin: a piece that cannot move' },
    body: { ru:
`Связка — фигура прикрывает собой что-то более ценное, и уйти не может.

Связка с королём называется абсолютной: слон или ладья бьют по линии, за фигурой король. Ходить этой фигурой нельзя — она открывает шах. Можно давить на неё пешками и ладьями, наращивая давление.

Связка с ферзём или ладьёй — относительная. Формально фигура может уйти, но за неё отдадут ферзя, и брать её почти всегда плохо.

Как использовать: раз вы знаете, что фигура прикована, — атакуйте её ещё раз. Она не убежит, только прикрытие усилится. Считайте, сколько раз вы бьёте и сколько защищают.`,
      en: `A pin is a piece shielding something more valuable, unable to move.

A pin against the king is called absolute: a bishop or rook attacks along a line, and the king stands behind the piece. That piece cannot move without exposing a check. You pile up on it with pawns and rooks.

A pin against the queen or a rook is relative. Formally the piece could move, but it would cost a queen, so taking it is usually bad.

How to use it: knowing the piece is tied down, attack it again. It cannot run, only the cover can grow. Count attackers and defenders.` }
  },

  {
    id: 'l06',
    title: { ru: 'Сквозной удар: бьём дальнюю фигуру', en: 'The skewer: hitting the far piece' },
    body: { ru:
`Сквозной удар — обратная связка. Бьёте самую ценную фигуру, она вынуждена отойти, а за ней стоит вторая, менее ценная, и её вы забираете.

Классика: шах королю ферзём, король уходит — ферзь или ладья забирает стоящую за ним ладью.

Проще всего увидеть сквозной удар на одной линии с королём. Проверяйте взглядом диагонали, вертикали и горизонтали от короля — там часто прячется добыча.

Ставьте так, чтобы удар был с шахом. Тогда у соперника нет выбора, и вы гарантированно забираете вторую фигуру.`,
      en: `A skewer is a pin in reverse. You attack the most valuable piece; it must move, and behind it stands a lesser piece that is yours to take.

Classic: check with the queen; the king steps aside; the queen or rook takes the rook behind it.

Skewers are easiest to spot on a line with the king. Scan the diagonals, files and ranks radiating from the king — the catch is often hiding there.

Arrange the skewer with check: your opponent has no choice, and the second piece is guaranteed.` }
  },

  {
    id: 'l07',
    title: { ru: 'Двойной удар пешкой', en: 'The pawn fork' },
    body: { ru:
`Пешка — самая дешёвая фигура, и удар пешкой особенно обиден: она бьёт две фигуры, но защищена соседними пешками.

Простая заготовка: поставьте пешку на клетку, где она бьёт коня и слона или коня и ладью. Соперник уведёт одну — вторая останется.

Особенно сильно, когда пешка бьёт с шахом. Тогда спасения почти нет.

Отсюда правило для защиты: перед каждым ходом смотрите, какие ваши фигуры стоят на клетках, которые бьют пешки соперника. Одна невнимательность — и вы теряете фигуру ни за что.`,
      en: `A pawn is the cheapest piece, and a pawn fork stings most: it attacks two pieces while being protected by its neighbours.

A simple setup: place a pawn where it hits a knight and a bishop, or a knight and a rook. Your opponent moves one; the other stays.

It is especially strong when the pawn gives check — then there is almost no escape.

Hence a defensive rule: before every move, look at which of your pieces sit on squares attacked by enemy pawns. One careless step costs you a piece for nothing.` }
  },

  {
    id: 'l08',
    title: { ru: 'Как поставить мат в один ход', en: 'How to mate in one' },
    body: { ru:
`Мат в один — это всегда ответ на вопрос «какая клетка рядом с королём не прикрыта и не занята?».

Смотрите три вещи:
1. Куда король может уйти? Эти клетки должны быть под боем или заняты своими фигурами.
2. Может ли кто-то закрыть линию шаха? Тогда шах должен идти в упор — с соседней клетки.
3. Можно ли съесть атакующую фигуру? Тогда она должна быть защищена.

Часто мат прячется за пешечным прикрытием короля. Ищите фигуру, которая бьёт именно те две клетки, куда король мог бы убежать.

Мат ферзём на последней горизонтали — самая частая финальная картинка для новичка.`,
      en: `A mate in one always answers the question "which square near the king is neither guarded nor occupied?".

Look at three things:
1. Where can the king go? Those squares must be attacked or blocked by its own pieces.
2. Can anyone block the line? Then the check must come from an adjacent square.
3. Can the attacker be captured? Then it must be defended.

Mate often hides behind the pawns around the king. Look for the piece that covers the two squares the king would run to.

A back-rank mate with the queen is the most common final picture for a beginner.` }
  },

  /* ---------- ДЕБЮТ ---------- */
  {
    id: 'l09',
    title: { ru: 'Три правила начала партии', en: 'Three opening rules' },
    body: { ru:
`Первое: займите центр. Пешки на e4 и d4 открывают дорогу слону и ферзю, контролируют четыре ключевые клетки.

Второе: выведите лёгкие фигуры — коней и слонов — на активные поля. Конь с g1 сильнее всего на f3 или e2, слон с f1 — на c4, b5 или e2.

Третье: рокируйте. Не позже седьмого-восьмого хода. Король в центре — мишень, и любая атака соперника вскроет его позицию.

Не выводите ферзя рано: его сразу начнут гнать, а вы потеряете темпы. Не двигайте одну фигуру дважды без причины. Не хватайте пешки в ущерб развитию.`,
      en: `One: take the centre. Pawns on e4 and d4 open lines for bishop and queen and control four key squares.

Two: develop the minor pieces — knights and bishops — to active squares. The knight from g1 is strongest on f3 or e2; the bishop from f1 on c4, b5 or e2.

Three: castle. By move seven or eight. A king in the centre is a target, and any attack will crack its position.

Do not bring the queen out early: it will be chased, and you lose tempi. Do not move the same piece twice without reason. Do not grab pawns at the cost of development.` }
  },

  {
    id: 'l10',
    title: { ru: 'Контроль центра', en: 'Control of the centre' },
    body: { ru:
`Четыре центральные клетки — d4, e4, d5, e5. Кто их контролирует, тот диктует игру.

Фигура в центре бьёт больше клеток, чем на краю. Конь на d4 смотрит на восемь полей, на a1 — только на два. Слон в центре простреливает всю доску.

Центр важен не тем, что там стоят пешки, а тем, что оттуда фигуры атакуют. Можно уступить центр и наказывать соперника за то, что его пешки скованы.

Если не хотите занимать центр своими пешками — контролируйте его фигурами. Пешка на e4 соперника в центре ослаблена, если её не защищает другая пешка; атакуйте её.`,
      en: `The four central squares are d4, e4, d5, e5. Whoever controls them dictates the play.

A piece in the centre attacks more squares than on the rim. A knight on d4 sees eight squares; on a1 it sees two. A bishop in the centre sweeps the whole board.

The centre matters not because pawns stand there, but because pieces strike from there. You can concede the centre and punish the opponent for having his pawns tied up.

If you do not want to occupy the centre with pawns, control it with pieces. An enemy pawn on e4 is weak if no pawn defends it; attack it.` }
  },

  {
    id: 'l11',
    title: { ru: 'Ловушки в дебюте', en: 'Opening traps' },
    body: { ru:
`Мат Легаля — старейшая ловушка. Слон и конь жертвуются, чтобы ферзь пришёл на поле и поставил мат по слабой линии.

«Пастуший мат» — ферзь и слон бьют по f7 (у чёрных) или f2 (у белых). Работает, только если соперник не защитил слабую пешку. Защита — конь на f3, ход d6 и рокировка.

Атака на f7 — самая частая угроза в первых ходах. Проверьте, прикрыто ли это поле до того, как соперник поставит туда ферзя и слона.

Не гонитесь за этими ловушками сами. Играйте нормальные ходы, и соперник подставится сам — потому что вы будете развивать фигуры, а он гоняться за пешками.`,
      en: `The Légal trap is the oldest trick: bishop and knight are sacrificed so that the queen arrives and mates along a weak line.

The Scholar's mate: queen and bishop strike f7 (against Black) or f2 (against White). It works only if the weak pawn is undefended. Defence: knight to f3, a move like d6 and castling.

Attacking f7 is the most common threat in the first moves. Check that square is covered before the opponent puts queen and bishop there.

Do not go hunting for these traps yourself. Play normal moves and the opponent will blunder on his own — because you are developing and he is chasing pawns.` }
  },

  {
    id: 'l12',
    title: { ru: 'Слабое поле f7 (f2)', en: 'The weak square f7 (f2)' },
    body: { ru:
`Пешка на f7 (или f2) защищена только королём. Поэтому она — самая хрупкая точка в начале партии.

Если вы поставите ферзя на h5, а слона на c4 — две фигуры смотрят на f7. Соперник обязан защитить поле: конь на f6, ход d6, рокировка.

Если соперник не защитил — мат в два хода.

Обратная сторона: когда вы рокируете, пешка f становится слабой наоборот — по линии f вскрывается король. Поэтому f-пешку часто двигают только под давлением.

Смотрите на f2 и f7 в каждой партии. Это то поле, где чаще всего решается исход первых двадцати ходов.`,
      en: `The pawn on f7 (or f2) is defended only by the king. That makes it the most fragile point in the opening.

Place your queen on h5 and bishop on c4, and two pieces look at f7. Black must defend: knight to f6, a move like d6, castling.

If it is not defended — mate in two.

The flip side: once you castle, the f-pawn becomes a weakness for the king along the f-file. That is why it is often only moved under pressure.

Watch f2 and f7 in every game. That square decides more openings than any other.` }
  },

  /* ---------- ТАКТИКА ---------- */
  {
    id: 'l13',
    title: { ru: 'Открытое нападение', en: 'Discovered attack' },
    body: { ru:
`Вы уводите одну фигуру, и открывается линия атаки для другой. Атакуют сразу две — та, что ушла, и та, что осталась за ней.

Самая сильная форма — вскрытый шах. Вы объявляете шах, уходя фигурой, и это гарантирует выигрыш темпа: соперник обязан отвечать на шах, а вы делаете второй ход, чтобы забрать что-то ценное.

Классическая заготовка: ладья стоит за слоном, слон смотрит на ферзя. Слон уходит с шахом — ладья бьёт ферзя.

Проверьте, не стоит ли где-то на одной линии с королём соперника ценная фигура, прикрытая вашей. Это самый прямой путь к быстрой победе.`,
      en: `You move one piece and open a line for another. Both attack at once — the one that stepped away and the one that was behind it.

The strongest form is a discovered check: you give check by moving a piece aside, which guarantees a tempo. The opponent must answer the check while you use the next move to take something valuable.

Classic setup: a rook behind a bishop, the bishop aiming at the queen. The bishop moves with check — the rook takes the queen.

Check whether a valuable enemy piece stands on the same line as its king, screened by one of yours. It is the shortest path to a quick win.` }
  },

  {
    id: 'l14',
    title: { ru: 'Мельница', en: 'The windmill' },
    body: { ru:
`Мельница — редкая, но самая разрушительная комбинация. Вскрытый шах повторяется снова и снова, а вы каждый раз забираете фигуру.

Схема: ладья даёт шах, вы уводите её на соседнюю линию, открывая шах слоном. Слон бьёт — снова шах королю. Слон возвращается на первую линию — снова шах. Так по кругу, пока не соберёте почти весь материал соперника.

Позиция запоминается сразу: король соперника в углу, ваши слон и ладья на соседних линиях.

В обычной партии не встретится, но узнавать её надо — один раз увидев, вы больше не забудете.`,
      en: `The windmill is rare but the most destructive combination there is. A discovered check repeats again and again while you take a piece each time.

The setup: a rook checks, you shift it to an adjacent file, opening a check from the bishop. The bishop takes something — check again. The bishop returns to the first file — check again. On and on, until almost all the opponent's material is gone.

The picture is memorable: the enemy king in the corner, your bishop and rook on neighbouring lines.

It will not appear in an ordinary game, but you must recognise it — having seen it once, you never forget it.` }
  },

  {
    id: 'l15',
    title: { ru: 'Жертва: когда отдавать фигуру', en: 'Sacrifice: when to give material' },
    body: { ru:
`Жертва оправдана, когда взамен вы получаете то, что нельзя посчитать шкалой 1–3–5–9.

Три случая:
1. Мат в несколько ходов. Тогда цена не важна — вы выигрываете партию.
2. Разрушение прикрытия короля. Пешка, открывающая короля соперника, часто сильнее целой фигуры.
3. Возврат с прибылью. Вы отдаёте коня, но через два хода забираете ладью.

Любая другая жертва — авантюра. Если вы не видите конкретного форсированного варианта до конца, не отдавайте фигуру «в надежде». Соперник защитится, и вы просто останетесь без материала.

Правило: жертва считается на три хода вперёд минимум. Если не считали — не жертвуйте.`,
      en: `A sacrifice is justified when what you get in return cannot be measured by 1–3–5–9.

Three cases:
1. Forced mate in a few moves. Then the price is irrelevant — you win the game.
2. Demolishing the king's cover. A pawn that opens up the enemy king is often worth a whole piece.
3. Returning with profit. You give a knight and two moves later take a rook.

Any other sacrifice is a gamble. If you cannot see a forced line to the end, do not give material "on hope". The opponent defends, and you are simply down a piece.

The rule: a sacrifice is calculated at least three moves ahead. If you have not counted, do not sacrifice.` }
  },

  {
    id: 'l16',
    title: { ru: 'Проходная пешка', en: 'The passed pawn' },
    body: { ru:
`Проходная — пешка, у которой на её вертикали и на соседних нет пешек соперника. Ей никто не мешает идти вперёд.

Проходная пешка в эндшпиле стоит больше фигуры. Соперник обязан блокировать её фигурой, а вы выигрываете время на другом участке.

Чем дальше пешка продвинулась, тем она опаснее. Пешка на седьмой горизонтали стоит почти как ферзь — соперник тратит фигуру только на то, чтобы не дать ей превратиться.

Создавайте проходные в эндшпиле. В миттельшпиле их надо поддерживать, а не гнать вперёд — иначе её легко заберут.`,
      en: `A passed pawn has no enemy pawns on its file or on the adjacent files. Nothing stands in its way.

In the endgame a passed pawn is worth more than a piece. The opponent must blockade it with a piece, while you gain time elsewhere.

The further it has advanced, the more dangerous it is. A pawn on the seventh rank is nearly a queen — the opponent spends a piece just to stop it from promoting.

Create passed pawns in the endgame. In the middlegame, support them rather than pushing them — otherwise they are easily taken.` }
  },

  {
    id: 'l17',
    title: { ru: 'Отвлечение и завлечение', en: 'Deflection and decoy' },
    body: { ru:
`Отвлечение: вы заставляете защитника уйти. Ферзь прикрывает мат по последней линии — заманите его ходом, от которого нельзя отказаться.

Завлечение: вы заставляете фигуру соперника встать на неудобную клетку. Часто заманивают короля под мат: жертвуете ладью, король вынужден её взять — и попадает под удар.

Оба приёма строятся на вынужденности. Ищите ход, который соперник не может проигнорировать: шах, взятие ферзя, мат в один ход. Отвлеките защитника этим ходом и нанесите решающий удар.

Проще всего искать так: где стоит главный защитник? Что он защищает? Как заставить его сдвинуться?`,
      en: `Deflection: force a defender away. The queen guards a back-rank mate — lure it with a move that cannot be declined.

Decoy: force an enemy piece onto an awkward square. Kings are often decoyed into mate: sacrifice a rook, the king must take, and it walks into the blow.

Both tricks rest on forcing moves. Look for the move your opponent cannot ignore: check, a queen capture, mate in one. Deflect the defender with that move and land the decisive strike.

The easiest way to search: where is the main defender? What does it guard? How do I make it step aside?` }
  },

  {
    id: 'l18',
    title: { ru: 'Перегрузка защитника', en: 'Overloading a defender' },
    body: { ru:
`Одна фигура не может защищать всё сразу. Если она прикрывает и клетку, и фигуру, и линию — атакуйте сразу два её объекта.

Схема: ладья прикрывает мат по последней линии и защищает коня. Вы атакуете коня — ладья обязана взять. Или наоборот, объявляете мат — ладья бросает коня.

Ищите фигуру, у которой много обязанностей. Её называют «перегруженной» — у неё нет ни секунды, чтобы сделать что-то ещё.

Это тактика расчёта, а не интуиции. Считайте: сколько объектов прикрывает фигура, сколько у неё защитников, что произойдёт, если убрать одну цель.`,
      en: `One piece cannot guard everything. If it covers a square, a piece, and a line — attack two of those duties at once.

The pattern: a rook both prevents a back-rank mate and defends a knight. You attack the knight — the rook must take. Or you threaten mate — the rook abandons the knight.

Look for a piece with too many jobs. It is called overloaded — it has not a second to do anything else.

This is calculation, not intuition. Count: how many things the piece guards, how many defenders it has, and what happens when one target is removed.` }
  },

  {
    id: 'l19',
    title: { ru: 'Как считать варианты', en: 'How to calculate lines' },
    body: { ru:
`Считайте только форсированные ходы: шахи, взятия, угрозы. Всё остальное — угадывание.

Порядок:
1. Какие у меня есть шахи?
2. Какие есть взятия, особенно с шахом?
3. Какие прямые угрозы я могу создать в один ход?

Проверяйте по очереди, а не всё сразу. Затем ищите ответ соперника — самый сильный, а не тот, который удобен вам.

Считайте до «тихой» позиции, где нет шахов и взятий. Именно там вариант заканчивается. Если после серии разменов вы просто на фигуру больше — вариант хороший.

У новичка ошибка почти всегда одна: он считает свои ходы и забывает ответные. Всегда меняйтесь местами — вы противник на один ход.`,
      en: `Calculate only forcing moves: checks, captures, threats. Everything else is guesswork.

The order:
1. What checks do I have?
2. What captures, especially with check?
3. What direct one-move threats can I make?

Go through them one by one, not all at once. Then find the opponent's reply — the strongest one, not the one that suits you.

Calculate down to a quiet position with no checks or captures. That is where the line ends. If after a series of trades you are simply a piece up, the line is good.

A beginner's mistake is nearly always the same: he counts his own moves and forgets the replies. Always swap sides — you are the opponent one move ahead.` }
  },

  /* ---------- СТРАТЕГИЯ ---------- */
  {
    id: 'l20',
    title: { ru: 'Пешечная структура', en: 'Pawn structure' },
    body: { ru:
`Пешки не возвращаются назад. Каждый ход пешкой необратим, и слабости, которые она создаёт, остаются до конца партии.

Сдвоенные пешки: две пешки на одной вертикали. Минус — они не защищают друг друга и не могут создать проходную. Плюс — открывают линию для ладьи.

Изолированная пешка: нет соседей. В эндшпиле её легко атаковать, но в миттельшпиле она даёт пространство и открытые линии.

Отсталая пешка: соседи ушли вперёд. Её трудно защищать, и она часто становится мишенью.

Прежде чем ходить пешкой, спросите: какую слабость я создаю? Можно ли это сделать фигурой? Может, лучше сначала закончить развитие?`,
      en: `Pawns never go back. Every pawn move is irreversible, and the weaknesses it creates last until the end.

Doubled pawns: two on one file. Minus — they cannot defend each other or produce a passer. Plus — they open a file for a rook.

Isolated pawn: no neighbours. Easy to attack in the endgame, but in the middlegame it grants space and open lines.

Backward pawn: its neighbours have moved on. Hard to defend, and often a target.

Before you move a pawn, ask: what weakness does this create? Could a piece do the job instead? Perhaps finish development first?` }
  },

  {
    id: 'l21',
    title: { ru: 'Хороший и плохой слон', en: 'Good bishop and bad bishop' },
    body: { ru:
`Слон ходит по одному цвету всю партию. Если его собственные пешки стоят на этом цвете, он заперт — это плохой слон.

Слон, чьи пешки стоят на другом цвете, свободен и стреляет через всю доску — это хороший слон.

Прежде чем менять слона на коня, посмотрите: чьи пешки лучше работают на его цвете? Если ваши заперли слона, он почти не хуже пешки — меняйте.

В открытой позиции слон обычно сильнее коня. В закрытой, с пешечными цепями, сильнее конь: он перепрыгивает через препятствия, а слон упирается.`,
      en: `A bishop stays on one colour the whole game. If its own pawns sit on that colour, it is locked in — a bad bishop.

A bishop whose pawns sit on the other colour is free and sweeps the whole board — a good bishop.

Before trading a bishop for a knight, look at whose pawns are on that bishop's colour. If yours have locked it in, it is barely better than a pawn — trade it.

In an open position a bishop is usually stronger than a knight. In a closed one, with pawn chains, the knight wins: it leaps over obstacles where the bishop runs into them.` }
  },

  {
    id: 'l22',
    title: { ru: 'Открытая линия и вторжение', en: 'Open files and invasion' },
    body: { ru:
`Открытая линия — вертикаль без пешек. Ладья, которая первой встанет на неё, контролирует всю доску по этой линии.

Что делать с открытой линией:
1. Поставьте туда ладью.
2. Сдвойте ладьи — вторая усиливает первую.
3. Вторгнитесь на седьмую горизонталь. Ладья на седьмой бьёт пешки и отрезает короля от центра.

Седьмая горизонталь — это почти всегда выигрыш материала. Ладья бьёт по двум пешкам сразу, а король соперника не может подойти — его отгонят.

Ищите открытые линии в каждой партии. Если соперник открыл её своим ходом — занимайте раньше, чем он спохватится.`,
      en: `An open file is one with no pawns on it. The first rook to occupy it controls the whole board along that line.

What to do with an open file:
1. Put a rook on it.
2. Double the rooks — the second reinforces the first.
3. Invade the seventh rank. A rook there hits pawns and cuts the king off from the centre.

The seventh rank almost always wins material. The rook hits two pawns at once, and the enemy king cannot come close — it will be driven off.

Look for open files in every game. If your opponent opens one with his own move, occupy it before he notices.` }
  },

  {
    id: 'l23',
    title: { ru: 'Активность важнее материала', en: 'Activity beats material' },
    body: { ru:
`Фигура, которая ничего не делает, — не фигура. Иногда лучше отдать пешку за то, чтобы ваша ладья встала на открытую линию.

Оценивая позицию, считайте три вещи:
1. Материал — сколько у кого фигур.
2. Активность — чьи фигуры больше бьют.
3. Безопасность короля — чей король защищён лучше.

Позиция, где вы на пешку меньше, но у вас две ладьи на открытых линиях и король соперника открыт, — выигрышная для вас.

Новичок считает только материал. Именно поэтому он зевает матовые атаки: у него формально «всё хорошо», а по факту через три хода мат.`,
      en: `A piece that does nothing is not a piece. Sometimes it is better to give a pawn so that your rook reaches an open file.

When evaluating, weigh three things:
1. Material — who has more pieces.
2. Activity — whose pieces attack more squares.
3. King safety — whose king is better protected.

A position where you are a pawn down but have two rooks on open files and the enemy king is exposed is winning for you.

A beginner counts material only. That is why he misses mating attacks: formally "everything is fine", but three moves later it is mate.` }
  },

  /* ---------- ЭНДШПИЛЬ ---------- */
  {
    id: 'l24',
    title: { ru: 'Король и пешка против короля', en: 'King and pawn against king' },
    body: { ru:
`Простое правило: если король защищающей стороны успевает встать на пути пешки — ничья. Если нет — пешка проходит в ферзи.

Считайте по «правилу квадрата». Нарисуйте мысленный квадрат: сторона от пешки до поля превращения. Если король успевает вступить в этот квадрат — он догонит пешку.

В эндшпиле король — сильная фигура. Он должен идти вперёд и прикрывать пешку. Ошибка новичка — прятать короля. В эндшпиле король идёт в центр и работает.

Оппозиция: два короля на одной линии через клетку. Тот, кто вынужден ходить, теряет оппозицию и пропускает соперника. Это ключ почти ко всем пешечным окончаниям.`,
      en: `A simple rule: if the defending king gets in front of the pawn, it is a draw. If not, the pawn promotes.

Count with the "rule of the square". Picture a square: from the pawn to its promotion square. If the king can step inside that square, it catches the pawn.

In the endgame the king is a strong piece. It must advance and escort the pawn. A beginner's mistake is to hide the king. In the endgame the king goes to the centre and works.

Opposition: two kings on one line with one square between them. Whoever must move loses the opposition and lets the opponent through. It is the key to almost every pawn ending.` }
  },

  {
    id: 'l25',
    title: { ru: 'Ладейный эндшпиль', en: 'Rook endgames' },
    body: { ru:
`Ладейные окончания — самые частые в шахматах. Их надо знать.

Главное правило: ладью ставьте позади проходной пешки. Своей — чтобы подталкивать. Чужой — чтобы атаковать сзади, где она не может защититься.

Позиция Луцены (ладья и пешка против ладьи, пешка на седьмой) — выигрыш. Ладья даёт шах, король уходит, пешка превращается. Стоит выучить наизусть.

Позиция Филидора (король защищающей стороны перед пешкой, ладья на третьей горизонтали) — ничья. Тоже запомнить.

В ладейных окончаниях активность решает больше, чем пешка. Часто лучший ход — не защищать, а атаковать ладьей с фланга.`,
      en: `Rook endgames are the most common in chess. You must know them.

Main rule: put the rook behind the passed pawn. Your own — to push it. The opponent's — to attack it from behind, where it cannot defend itself.

The Lucena position (rook and pawn against rook, pawn on the seventh) is a win. The rook checks, the king steps aside, the pawn promotes. Learn it by heart.

The Philidor position (the defending king in front of the pawn, the rook on the third rank) is a draw. Learn that too.

In rook endings, activity matters more than a pawn. Often the best move is not to defend but to attack with the rook from the flank.` }
  },

  {
    id: 'l26',
    title: { ru: 'Типичные ошибки новичка', en: 'Typical beginner mistakes' },
    body: { ru:
`Десять ошибок, которые проигрывают партию чаще всего:

1. Развитие ферзя в начале. Ферзь выходит — его гонят — темп потерян.
2. Отсутствие рокировки. Король в центре — мишень.
3. Захват пешек в ущерб развитию. Пешка не стоит трёх темпов.
4. Повторные ходы одной фигурой без причины.
5. Движение крайних пешек без необходимости — ослабляют короля.
6. Отсутствие счёта ответных ходов. Считаете себя — забудете соперника.
7. Оставление фигуры под боем «на авось». Иногда прокатывает, чаще нет.
8. Игра без плана. Просто «сделал ход».
9. Страх разменов. Иногда размен — единственный правильный ход.
10. Сдача партии, когда вы на фигуру меньше. Материал — не всё; иногда спасение есть.

Если уберёте эти десять ошибок — уже будете играть сильнее восьмидесяти процентов любителей.`,
      en: `Ten mistakes that lose games more than any others:

1. Bringing the queen out early. It gets chased, and you lose tempi.
2. Never castling. A king in the centre is a target.
3. Grabbing pawns at the cost of development. A pawn is not worth three tempi.
4. Moving the same piece twice without reason.
5. Pushing edge pawns for no reason — it weakens the king.
6. Not counting replies. You count yourself and forget the opponent.
7. Leaving a piece hanging "on hope". Sometimes it works, usually not.
8. Playing without a plan. Just "making a move".
9. Fearing trades. Sometimes a trade is the only correct move.
10. Resigning when you are a piece down. Material is not everything; there is sometimes a save.

Remove these ten and you will already play better than eighty percent of amateurs.` }
  }

];
