/* ============================================================
   Партия против бота в настоящем браузере: телефон и компьютер.

   Запуск:  node scripts/test-chess-play.js

   Страница открывается через локальный http-сервер, а не file://:
   фоновый поток (Web Worker) с file:// браузер не запускает, а
   проверить нужно именно его. Отдельной проверкой — что с file://
   бот всё равно ходит (запасной путь в основном потоке).

   Телефон (касания):
     • доска на всю ширину экрана, горизонтальной прокрутки нет;
     • нижняя панель: три кнопки в одну строку, прилипает к низу,
       не видна, пока партия не начата;
     • тап по фигуре — подсказка под доской, второй тап — прячет;
     • сразу после хода — «Бот думает…», ответ считает поток;
     • «Подсказка» — лучший ход с подсветкой полей, повтор прячет;
     • оценка хода свёрнута в строку и раскрывается по нажатию;
     • «Отменить ход» и «Новая партия» (с подтверждением).
   Компьютер (мышь):
     • подсказка по наведению, уход с доски прячет;
     • пока поток считает тяжёлую позицию, страница не замирает.
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml' };
const MIDGAME = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7';

let failed = 0, passed = 0;
function ok(cond, name, extra) {
  if (cond) { passed++; return; }
  failed++;
  console.error('✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''));
}

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

async function open(browser, base, opts) {
  const ctx = await browser.newContext(opts);
  /* сеть наружу не нужна: Supabase, CDN и Worker в Cloudflare */
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await ctx.addInitScript(() => {
    try { localStorage.setItem('sky_lang', '"ru"'); localStorage.setItem('sky_chess_game_mode', 'coach'); } catch (e) {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/chess.html');
  await page.waitForFunction(() => window.SkyChessGame && window.SkyChessPlayUI && document.getElementById('gameFlowRoot'));
  return { ctx, page, errors };
}

async function startGame(page, mode) {
  await page.click('.tabs button[data-tab="game"]');
  await page.click(`[data-flow-mode="${mode}"]`);
  await page.click('.game-flow-start');
  await page.waitForFunction(() => document.getElementById('tab-game').classList.contains('game-flow-started'));
  await page.waitForTimeout(250);
}

const sqOf = (page, alg) => page.evaluate(a => ChessEngine.fromAlg(a), alg);
const hintText = page => page.$eval('#gHint', e => e.textContent.trim());

(async () => {
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();

  /* ================= телефон ================= */
  {
    const { ctx, page, errors } = await open(browser, base, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const tap = async alg => page.tap(`#gBoard [data-sq="${await sqOf(page, alg)}"]`);

    ok(await page.evaluate(() => SkyChessPlayUI.isTouch && ChessAIAsync.isTouch), 'касание определено');
    ok(await page.evaluate(() => ChessAIAsync.isMobile && ChessAIAsync.plan(4).maxDepth === 3 && ChessAIAsync.plan(3).minDepth === 2), 'телефон: глубина 2–3');
    await page.click('.tabs button[data-tab="game"]');
    ok(await page.$eval('#gDock', e => e.hidden), 'панель скрыта до начала партии');

    await startGame(page, 'coach');
    ok(!(await page.$eval('#gDock', e => e.hidden)), 'панель видна после начала партии');

    const geo = await page.evaluate(() => {
      const b = document.getElementById('gBoard').getBoundingClientRect();
      return { x: b.x, w: b.width, vw: innerWidth, scroll: document.documentElement.scrollWidth };
    });
    ok(Math.abs(geo.x) < 1 && Math.abs(geo.w - geo.vw) < 1, 'доска на всю ширину', geo);
    ok(geo.scroll <= geo.vw, 'нет горизонтальной прокрутки', geo);

    const dock = await page.evaluate(() => {
      window.scrollTo(0, document.getElementById('gBoard').getBoundingClientRect().top + scrollY - 70);
      const btns = [...document.querySelectorAll('#gDock .btn')].map(b => b.getBoundingClientRect());
      const d = document.getElementById('gDock').getBoundingClientRect();
      return { tops: btns.map(r => Math.round(r.top)), n: btns.length, bottom: d.bottom, vh: innerHeight, pos: getComputedStyle(document.getElementById('gDock')).position };
    });
    ok(dock.n === 3 && Math.max(...dock.tops) - Math.min(...dock.tops) <= 2, 'три кнопки в одну строку', dock);
    const clipped = await page.$$eval('#gDock .btn', els => els.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent.trim()));
    ok(!clipped.length, 'подписи кнопок не обрезаны', clipped);
    ok(dock.pos === 'sticky' && dock.bottom <= dock.vh + 1 && dock.bottom > dock.vh - 40, 'панель прилипла к низу экрана', dock);

    /* подсказка по касанию */
    ok(/Коснитесь/.test(await hintText(page)), 'под доской — приглашение коснуться');
    await tap('g1');
    let h = await hintText(page);
    ok(/Конь/.test(h) && /Nf3/.test(h) && /Nh3/.test(h), 'тап по коню: имя и ходы', h);
    ok(await page.$eval('#gBoard', (b) => !!b.querySelector('.g-peek')), 'клетка подсвечена');
    await tap('g1');
    h = await hintText(page);
    ok(/Коснитесь/.test(h), 'второй тап прячет подсказку', h);
    ok(await page.evaluate(() => SkyChessGame.board.selected === -1), 'второй тап снимает выделение');
    await tap('e7');
    ok(/соперника/.test(await hintText(page)), 'тап по чужой фигуре');
    await tap('e4');
    ok(/Поле e4/.test(await hintText(page)) && /e4/.test(await hintText(page)), 'тап по пустому полю');

    /* ход и «Бот думает…» */
    await tap('e2');
    await tap('e4');
    await page.waitForTimeout(40);
    const think = await page.evaluate(() => ({ badge: !document.getElementById('gThink').hidden, status: document.getElementById('gStatus').textContent }));
    ok(think.badge && /Бот думает/.test(think.status), '«Бот думает…» сразу после хода', think);
    ok(!/Пешка/.test(await hintText(page)), 'после хода подсказка по клетке ушла');
    const t0 = Date.now();
    await page.waitForFunction(() => SkyChessGame.moves === 2 && !SkyChessGame.busy, null, { timeout: 8000 }).catch(() => {});
    const took = Date.now() - t0;
    ok(await page.evaluate(() => SkyChessGame.moves === 2), 'бот ответил');
    ok(took < 4500, 'ответ бота с анимацией быстрее 4,5 с', took);
    ok(await page.evaluate(() => ChessAIAsync.lastVia) === 'worker', 'считал фоновый поток');
    ok(await page.$eval('#gThink', e => e.hidden), '«Бот думает…» исчез после ответа');

    /* оценка хода: строка → полный разбор */
    await page.waitForSelector('#gReview .rv-compact', { timeout: 5000 });
    const rv = await page.evaluate(() => ({ line: document.querySelector('#gReview .rv-compact').textContent, full: document.querySelector('#gReview .rv-full').hidden }));
    ok(/e4/.test(rv.line) && rv.full, 'оценка хода свёрнута в строку', rv);
    await page.tap('#gReview .rv-compact');
    ok(!(await page.$eval('#gReview .rv-full', e => e.hidden)), 'нажатие раскрывает разбор');

    /* лучший ход */
    await page.tap('#gDockHint');
    await page.waitForFunction(() => /Идея/.test(document.getElementById('gHint').textContent), null, { timeout: 6000 }).catch(() => {});
    h = await hintText(page);
    ok(/Идея/.test(h), 'кнопка «Подсказка» — лучший ход', h);
    ok(await page.$$eval('#gBoard .g-hint-from, #gBoard .g-hint-to', e => e.length) === 2, 'поля хода подсвечены');
    ok(await page.$eval('#gDockHint', e => e.getAttribute('aria-pressed')) === 'true', 'кнопка нажата');
    await page.tap('#gDockHint');
    ok(!/Идея/.test(await hintText(page)) && await page.$$eval('#gBoard .g-hint-from', e => e.length) === 0, 'повторное нажатие прячет');

    /* ещё ход: разбор остаётся раскрытым, подсказка лучшего хода сбрасывается */
    await page.tap('#gDockHint');
    await page.waitForFunction(() => /Идея/.test(document.getElementById('gHint').textContent), null, { timeout: 6000 }).catch(() => {});
    await tap('d2');
    await tap('d4');
    ok(!/Идея/.test(await hintText(page)), 'после хода старая «Идея» исчезла');
    await page.waitForFunction(() => SkyChessGame.moves === 4 && !SkyChessGame.busy, null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(150);
    ok(!(await page.$eval('#gReview .rv-full', e => e.hidden).catch(() => true)), 'раскрытый разбор остаётся раскрытым');

    /* отмена и новая партия */
    await page.tap('#gDockUndo');
    ok(await page.evaluate(() => SkyChessGame.moves) === 2, '«Отменить ход» откатывает ход и ответ');
    await page.tap('#gDockNew');
    await page.waitForSelector('#gDockNewYes', { timeout: 3000 }).catch(() => {});
    ok(!!(await page.$('#gDockNewYes')), 'новая партия посреди игры — с подтверждением');
    if (await page.$('#gDockNewYes')) await page.click('#gDockNewYes');
    await page.waitForTimeout(200);
    ok(await page.evaluate(() => SkyChessGame.moves) === 0, 'новая партия началась');

    /* «Сдаться» при пошаговом запуске: кнопка рядом с «Перевернуть доску» */
    await tap('e2'); await tap('e4');
    await page.waitForFunction(() => SkyChessGame.moves === 2 && !SkyChessGame.busy, null, { timeout: 8000 }).catch(() => {});
    await page.waitForFunction(() => { const b = document.getElementById('gResign'); return b && !b.hidden && !b.disabled; }, null, { timeout: 3000 }).catch(() => {});
    ok(await page.evaluate(() => { const b = document.getElementById('gResign'); return !!b && !b.hidden && !b.disabled && b.offsetParent !== null; }), '«Сдаться» видна и доступна в свой ход');
    await page.tap('#gResign');
    await page.waitForSelector('.modal #experienceClose', { timeout: 3000 }).catch(() => {});
    ok(/Вы сдались/.test(await page.$eval('#gStatus', e => e.textContent)) && await page.$eval('#gBoard', b => b.classList.contains('game-board-locked')), 'сдался: статус и доска заблокирована');
    if (await page.$('.modal #experienceClose')) await page.click('.modal #experienceClose');
    ok(await page.$eval('#gResign', b => b.disabled), 'после сдачи «Сдаться» неактивна');
    await page.tap('#gDockNew');
    await page.waitForSelector('#gDockNewYes', { timeout: 3000 }).catch(() => {});
    if (await page.$('#gDockNewYes')) await page.click('#gDockNewYes');
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => SkyChessGame.moves === 0 && !document.getElementById('gBoard').classList.contains('game-board-locked')), 'после сдачи «Новая партия» снимает блокировку');
    await tap('d2'); await tap('d4');
    await page.waitForFunction(() => SkyChessGame.moves === 2 && !SkyChessGame.busy, null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(100);
    ok(await page.evaluate(() => SkyChessGame.moves === 2) && !(await page.$eval('#gResign', b => b.disabled)), 'новая партия после сдачи: бот ходит, сдаться снова можно');

    /* вкладки: повторные клики и смена языка больше не ломают переключение */
    for (const t of ['lessons', 'puzzles', 'teacher', 'live', 'game', 'lessons', 'game']) await page.click(`.tabs button[data-tab="${t}"]`);
    await page.evaluate(() => Sky.setLang('en'));
    await page.waitForTimeout(100);
    await page.click('.tabs button[data-tab="puzzles"]');
    ok(await page.evaluate(() => !document.getElementById('tab-puzzles').classList.contains('hidden') && document.getElementById('tab-game').classList.contains('hidden')), 'после смены языка вкладки переключаются');
    await page.click('.tabs button[data-tab="teacher"]');
    ok(await page.evaluate(() => { const t = document.getElementById('tab-teacher'); return !!t && !t.classList.contains('hidden') && t.querySelectorAll('#tGate, #tBody').length === 2; }), 'вкладка «С учителем» на месте и открывается');
    await page.evaluate(() => Sky.setLang('ru'));

    ok(!errors.length, 'телефон: без ошибок на странице', errors);
    await ctx.close();
  }

  /* ================= компьютер ================= */
  {
    const { ctx, page, errors } = await open(browser, base, { viewport: { width: 1280, height: 900 } });
    ok(await page.evaluate(() => !SkyChessPlayUI.isTouch), 'мышь: касание не определено');
    ok(await page.evaluate(() => !ChessAIAsync.isMobile && ChessAIAsync.plan(4).maxDepth === 4 && ChessAIAsync.plan(4).minDepth === 3), 'компьютер: глубина 3–4');
    await startGame(page, 'solo');
    await page.mouse.move(5, 5);
    ok(/Наведите/.test(await hintText(page)), 'под доской — приглашение навести');
    await page.hover(`#gBoard [data-sq="${await sqOf(page, 'b1')}"]`);
    const h = await hintText(page);
    ok(/Конь/.test(h) && /Nc3/.test(h), 'наведение на коня', h);
    await page.mouse.move(5, 5);
    ok(/Наведите/.test(await hintText(page)), 'уход с доски прячет подсказку');

    /* страница живая, пока поток считает тяжёлую позицию */
    const live = await page.evaluate(async (fen) => {
      const st = ChessEngine.create(fen);
      let last = performance.now(), gap = 0, run = true;
      const tick = (t) => { gap = Math.max(gap, t - last); last = t; if (run) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      const r = await ChessAIAsync.bestMove(st, 4);
      run = false;
      return { gap: Math.round(gap), ms: r && r.ms, depth: r && r.depth, via: ChessAIAsync.lastVia, legal: !!(r && r.move) };
    }, MIDGAME);
    ok(live.legal && live.via === 'worker', 'тяжёлую позицию считает поток', live);
    ok(live.ms < 3000 + 700, 'потолок 3 секунды', live);
    ok(live.gap < 250 || live.ms < 250, 'кадры идут, пока бот думает', live);

    ok(!errors.length, 'компьютер: без ошибок на странице', errors);
    await ctx.close();
  }

  /* ================= file:// — без потока ================= */
  {
    const ctx = await browser.newContext();
    await ctx.route(/^https?:/, r => r.abort());
    const page = await ctx.newPage();
    await page.goto('file://' + path.join(ROOT, 'chess.html'));
    await page.waitForFunction(() => window.ChessAIAsync);
    const r = await page.evaluate(async () => {
      const res = await ChessAIAsync.bestMove(ChessEngine.create(ChessEngine.START_FEN), 2);
      return { move: !!(res && res.move), via: ChessAIAsync.lastVia };
    });
    ok(r.move && r.via === 'main', 'file://: бот ходит без потока', r);
    await ctx.close();
  }

  await browser.close();
  server.close();
  if (failed) { console.error(`Шахматы в браузере: ${failed} ошибок, ${passed} проверок прошли`); process.exit(1); }
  console.log(`Шахматы в браузере: ${passed} проверок пройдено`);
})().catch(e => { console.error(e); process.exit(1); });
