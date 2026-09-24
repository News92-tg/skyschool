/* ============================================================
   SkyySchool — портреты шахматных тренеров.

   ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ
   --------------------
   Прежние аватарки лежали в chess-teacher-ui-core.js и рисовались
   одной функцией face(accent, hair, accessory): круг, одинаковое
   лицо, одинаковые глаза-точки, одинаковая улыбка — менялись только
   цвет фона и одна деталь поверх. Профессор и Строгий Гроссмейстер
   отличались друг от друга единственной чёрточкой, и на 48 пикселях
   их было не различить.

   Здесь лица нарисованы по отдельности: разная форма головы, разные
   причёски, брови, взгляд и одежда. Файл ничего не ломает в ядре — он
   только подменяет содержимое ChessTeacherUI.FACES и просит
   перерисовать то, что уже нарисовано. Если этот файл не подключить,
   всё продолжит работать на старых аватарках.

   ЧЕСТНО О «РЕАЛИСТИЧНОСТИ»
   -------------------------
   Это векторная иллюстрация, а не фотография: SVG без внешних картинок
   фотореализм не даёт, и обещать его было бы враньём. Задача здесь
   другая и выполнимая — чтобы шестерых было видно с одного взгляда и
   чтобы лицо совпадало с характером разбора.

   РАЗМЕР
   ------
   Холст 256×256, рисунок вписан в круг: .tui-face режет квадрат в
   окружность, и всё, что выходит за радиус 128, будет обрезано.
   Проверено на 48 пикселях (карточки выбора) и на 45 (плашка текущего
   тренера) — мелкие детали вроде бликов в глазах там не мешают, а
   силуэт причёски различим.
   ============================================================ */
'use strict';

(function () {

  /* Общие куски. Всё, что повторяется у всех шестерых, — здесь, чтобы
     в описании каждого тренера осталось только его собственное.

     ГЕОМЕТРИЯ (первый вариант пришлось переделать)
     ----------------------------------------------
     Сначала подбородок строился отдельной дугой под овалом головы —
     и все шестеро вышли длиннолицыми, как на вытянутом отражении.
     Теперь голова — один путь, и подбородок задаётся шириной, а не
     длиной: jaw от 18 (узкий) до 40 (тяжёлая челюсть).

     Опорные точки, от которых считается всё остальное:
       макушка 38, линия глаз 96, рот 130, подбородок 154,
       края лица 82 и 174, шея 132–176, плечи от 172.
     Если двигать одно, двигать придётся всё — поэтому числа здесь
     повторяются явно, а не прячутся за переменными. */

  function bg(from, to, id) {
    return '<defs><radialGradient id="' + id + '" cx="50%" cy="32%" r="80%">' +
      '<stop offset="0%" stop-color="' + from + '"/><stop offset="100%" stop-color="' + to + '"/>' +
      '</radialGradient></defs>' +
      '<circle cx="128" cy="128" r="128" fill="url(#' + id + ')"/>';
  }

  /* Плечи широкой дугой от края до края: так фигура стоит в круге,
     а не висит головой в пустоте. */
  function shoulders(cloth, collar) {
    return '<path d="M22 256 Q28 190 86 172 L170 172 Q228 190 234 256 Z" fill="' + cloth + '"/>' +
      (collar || '');
  }

  /* Шея рисуется ДО головы: её верх уходит под подбородок и не виден.
     Тень под челюстью обязательна — без неё голова выглядит наклеенной. */
  function neck(skin, shade) {
    return '<path d="M106 128 L150 128 L150 176 Q128 188 106 176 Z" fill="' + skin + '"/>' +
      '<path d="M104 142 Q128 164 152 142 L152 128 L104 128 Z" fill="' + shade + '" opacity=".5"/>';
  }

  function head(skin, jaw) {
    const cw = jaw;
    return '<ellipse cx="82" cy="100" rx="7" ry="11" fill="' + skin + '"/>' +
      '<ellipse cx="174" cy="100" rx="7" ry="11" fill="' + skin + '"/>' +
      '<path d="M82 94 C82 56 100 38 128 38 C156 38 174 56 174 94 ' +
      'C174 122 ' + (128 + cw) + ' 154 128 154 C' + (128 - cw) + ' 154 82 122 82 94 Z" fill="' + skin + '"/>';
  }

  /* Глаза. Радужка своего цвета плюс блик: без блика взгляд мёртвый.
     lid — насколько опущено верхнее веко (прищур). */
  function eyes(iris, lid) {
    function one(x) {
      return '<ellipse cx="' + x + '" cy="96" rx="9.4" ry="6.2" fill="#fdfbf7"/>' +
        '<circle cx="' + x + '" cy="96" r="4.9" fill="' + iris + '"/>' +
        '<circle cx="' + x + '" cy="96" r="2.3" fill="#16181d"/>' +
        '<circle cx="' + (x + 1.9) + '" cy="93.7" r="1.5" fill="#fff" opacity=".92"/>' +
        '<path d="M' + (x - 9.8) + ' ' + (96 - lid) + ' Q' + x + ' ' + (88 - lid) + ' ' + (x + 9.8) + ' ' + (96 - lid) +
        '" fill="none" stroke="#3a2b22" stroke-width="2.1" stroke-linecap="round"/>';
    }
    return one(110) + one(146);
  }

  /* Брови — главный носитель характера. angle>0 сводит их к переносице
     (строгость), angle<0 поднимает внешние концы (доброта). */
  function brows(color, angle, thick) {
    const t = thick || 5;
    return '<path d="M97 ' + (80 + angle) + ' Q109 ' + (74 + angle * 1.4) + ' 121 ' + (79 - angle * 0.4) +
      '" fill="none" stroke="' + color + '" stroke-width="' + t + '" stroke-linecap="round"/>' +
      '<path d="M135 ' + (79 - angle * 0.4) + ' Q147 ' + (74 + angle * 1.4) + ' 159 ' + (80 + angle) +
      '" fill="none" stroke="' + color + '" stroke-width="' + t + '" stroke-linecap="round"/>';
  }

  function nose(shade) {
    return '<path d="M128 100 L123.5 114 Q128 117.5 132.5 114" fill="none" stroke="' + shade +
      '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".72"/>';
  }

  /* curve>0 — улыбка, curve<0 — опущенные углы рта. */
  function mouth(color, curve, width) {
    const w = width || 15;
    return '<path d="M' + (128 - w) + ' 130 Q128 ' + (130 + curve) + ' ' + (128 + w) + ' 130" fill="none" stroke="' +
      color + '" stroke-width="3" stroke-linecap="round"/>';
  }

  const wrap = inner => '<svg viewBox="0 0 256 256" role="img" aria-hidden="true">' + inner + '</svg>';

  /* ---------------------------------------------------------------
     Шестеро. Порядок тот же, что в TEACHERS.
     --------------------------------------------------------------- */
  const P = {};

  /* Атакующий Огонь — молодой, рыжий ёжик, брови сведены, но рот
     улыбается: напор, а не злость. */
  P['coach-fire'] = wrap(
    bg('#f0603c', '#8e2418', 'gFire') +
    shoulders('#c2372a',
      '<path d="M112 174 L128 202 L144 174" fill="none" stroke="#f4ede4" stroke-width="7" stroke-linejoin="round"/>') +
    neck('#e8b183', '#b97e53') +
    head('#e8b183', 26) +
    '<path d="M82 90 Q80 40 128 34 Q176 40 174 90 Q166 58 128 54 Q90 58 82 90 Z" fill="#a8391c"/>' +
    '<path d="M92 54 L98 28 L109 52 Z M117 48 L126 20 L135 48 Z M145 52 L156 28 L162 56 Z" fill="#a8391c"/>' +
    brows('#7d2712', 4, 5.4) +
    eyes('#5a3418', 1) +
    nose('#b97e53') +
    mouth('#8c3a2a', 9)
  );

  /* Спокойный Стратег — старше всех, ровный пробор, седина на висках
     тонкими прядями вдоль линии волос, а не шапкой. Полуприкрытые
     веки, ровная линия рта. Ничего резкого. */
  P['coach-calm'] = wrap(
    bg('#4f9fd0', '#164b73', 'gCalm') +
    shoulders('#2e6f9e',
      '<path d="M110 174 L128 196 L146 174" fill="none" stroke="#d9e6ef" stroke-width="7" stroke-linejoin="round"/>') +
    neck('#f0c9a8', '#c2946f') +
    head('#f0c9a8', 27) +
    /* Косой пробор: прядь идёт ото лба вправо и вниз. Симметричная
       «шапка» первого варианта выглядела мотоциклетным шлемом. */
    '<path d="M80 102 Q77 38 128 34 Q179 38 176 102 Q174 74 166 62 ' +
      'Q150 78 120 76 Q100 74 88 86 Q82 92 80 102 Z" fill="#4a5560"/>' +
    '<path d="M108 44 Q150 44 168 66 Q146 54 112 58 Q96 62 88 76 Q92 52 108 44 Z" fill="#59646f"/>' +
    '<path d="M80 102 Q80 84 86 72 Q83 86 84 103 Z" fill="#b3bcc6" opacity=".8"/>' +
    '<path d="M176 102 Q176 84 170 72 Q173 86 172 103 Z" fill="#b3bcc6" opacity=".8"/>' +
    brows('#717b86', -1, 4.6) +
    eyes('#3d6b7d', 3) +
    nose('#c2946f') +
    mouth('#9c6a55', 2, 13)
  );

  /* Профессор Расчёт — залысины подковой, очки, взгляд поверх оправы,
     губы поджаты: сейчас скажет, что вариант не досчитан.
     Бабочка вместо прежнего пятна на груди — то читалось как клякса. */
  P['coach-prof'] = wrap(
    bg('#9b74d8', '#3a2668', 'gProf') +
    /* Ворот рубашки под жилетом. Бабочка, которую я нарисовал сначала,
       на 48 пикселях читалась как осколок стекла на груди — убрал. */
    shoulders('#4a3780',
      '<path d="M104 172 L128 206 L152 172 L142 170 L128 192 L114 170 Z" fill="#efe9fa"/>' +
      '<path d="M120 190 L136 190 L134 224 L128 230 L122 224 Z" fill="#7a5fc4"/>') +
    neck('#f2d3b5', '#c49a78') +
    head('#f2d3b5', 25) +
    /* Подкова: волосы идут от висков назад, макушка открыта. */
    /* Волосы только по бокам, ото лба назад. Поперечная полоса по
       макушке, которая была здесь раньше, превращала залысину в
       повязку на голове. Теперь темя открыто, и на нём блик. */
    '<path d="M81 108 Q78 70 98 54 Q104 62 98 74 Q90 88 88 110 Z" fill="#8f949c"/>' +
    '<path d="M175 108 Q178 70 158 54 Q152 62 158 74 Q166 88 168 110 Z" fill="#8f949c"/>' +
    '<ellipse cx="118" cy="52" rx="20" ry="8" fill="#fff" opacity=".13"/>' +
    brows('#8a9098', 2, 4.2) +
    eyes('#4a5a6b', 2) +
    nose('#c49a78') +
    '<g fill="none" stroke="#2f3238" stroke-width="3.2">' +
    '<circle cx="110" cy="97" r="15"/><circle cx="146" cy="97" r="15"/>' +
    '<path d="M125 95 Q128 92 131 95"/><path d="M95 94 L83 98"/><path d="M161 94 L173 98"/></g>' +
    '<path d="M101 89 Q106 85 112 86" stroke="#fff" stroke-width="2.4" fill="none" opacity=".42"/>' +
    mouth('#a06a58', -2, 12)
  );

  /* Добрый Тренер — единственный, кто улыбается зубами; круглые формы,
     брови домиком, румянец. */
  P['coach-friend'] = wrap(
    bg('#4fc08a', '#14663f', 'gFriend') +
    shoulders('#2f9466',
      '<path d="M108 174 Q128 190 148 174" fill="none" stroke="#e8f6ef" stroke-width="7"/>') +
    neck('#c98d5e', '#9a6338') +
    head('#c98d5e', 30) +
    '<g fill="#2a1a12"><circle cx="97" cy="60" r="17"/><circle cx="119" cy="48" r="19"/>' +
    '<circle cx="141" cy="48" r="19"/><circle cx="161" cy="60" r="17"/>' +
    '<circle cx="86" cy="82" r="13"/><circle cx="170" cy="82" r="13"/></g>' +
    brows('#2a1a12', -4, 5) +
    eyes('#4a2c17', 0) +
    nose('#9a6338') +
    '<ellipse cx="96" cy="114" rx="9" ry="6" fill="#d8735c" opacity=".3"/>' +
    '<ellipse cx="160" cy="114" rx="9" ry="6" fill="#d8735c" opacity=".3"/>' +
    '<path d="M111 127 Q128 146 145 127 Z" fill="#7a3a2e"/>' +
    '<path d="M113 128 Q128 135 143 128 Z" fill="#fdfbf7"/>'
  );

  /* Строгий Гроссмейстер — тяжёлая челюсть, зачёс назад, седина
     тонкой прядью по краю (в первом варианте она читалась как
     наушники), бородка, рот прямой линией. Единственный без улыбки. */
  P['coach-strict'] = wrap(
    bg('#5c6472', '#191c22', 'gStrict') +
    shoulders('#2b2f37',
      '<path d="M110 172 L128 200 L146 172" fill="none" stroke="#e7e9ec" stroke-width="7" stroke-linejoin="round"/>' +
      '<path d="M121 186 L135 186 L133 210 L128 216 L123 210 Z" fill="#8f2f2a"/>') +
    neck('#d9a377', '#a97247') +
    head('#d9a377', 32) +
    '<path d="M80 92 Q76 36 128 32 Q180 36 176 92 Q170 54 128 52 Q86 54 80 92 Z" fill="#1d2026"/>' +
    '<path d="M81 94 Q81 72 90 58 Q87 76 86 95 Z" fill="#8d939c" opacity=".9"/>' +
    '<path d="M175 94 Q175 72 166 58 Q169 76 170 95 Z" fill="#8d939c" opacity=".9"/>' +
    brows('#1d2026', 7, 6) +
    eyes('#3a4450', 3) +
    nose('#a97247') +
    /* Усы и бородка. Между ними оставлен зазор, чтобы линия рта
       осталась видна — иначе весь низ лица сливался в тёмное пятно. */
    '<path d="M110 124 Q128 118 146 124 Q128 130 110 124 Z" fill="#1d2026"/>' +
    /* Бородка кольцом: усы соединены с подбородком тонкими дужками по
       краям рта. Отдельно висящий клин под губой читался чёрным
       восклицательным знаком, а не бородой. */
    '<path d="M110 124 Q106 140 112 150 Q128 160 144 150 Q150 140 146 124 ' +
      'Q142 136 128 138 Q114 136 110 124 Z" fill="#1d2026"/>' +
    '<path d="M117 132 L139 132" stroke="#8a5641" stroke-width="2.8" stroke-linecap="round"/>'
  );

  /* Романтик Атаки — длинные волнистые волосы, приподнятая бровь,
     шарф, серьга. */
  P['coach-romantic'] = wrap(
    bg('#c470d0', '#4d1a5c', 'gRom') +
    shoulders('#8f3d9c', '') +
    '<path d="M92 176 Q128 198 164 176 L170 192 Q128 216 86 192 Z" fill="#e2b13c"/>' +
    '<path d="M152 190 L176 244 L156 248 L142 198 Z" fill="#c9962c"/>' +
    neck('#f3cdb0', '#c4936e') +
    /* Масса волос рисуется ДО головы, чтобы лечь за ней. */
    '<path d="M74 112 Q64 40 128 34 Q192 40 182 112 Q190 162 172 184 L84 184 Q66 162 74 112 Z" fill="#33202e"/>' +
    head('#f3cdb0', 25) +
    '<path d="M80 94 Q78 40 128 36 Q178 40 176 94 Q168 58 128 54 Q88 58 80 94 Z" fill="#40283a"/>' +
    '<path d="M83 92 Q91 56 115 50 Q95 66 91 100 Z" fill="#33202e"/>' +
    '<path d="M173 92 Q165 56 141 50 Q161 66 165 100 Z" fill="#33202e"/>' +
    /* Одна бровь выше другой — симметричная функция тут не годится. */
    '<path d="M97 82 Q109 76 121 80" fill="none" stroke="#33202e" stroke-width="4.8" stroke-linecap="round"/>' +
    '<path d="M135 76 Q147 68 159 74" fill="none" stroke="#33202e" stroke-width="4.8" stroke-linecap="round"/>' +
    eyes('#6b3560', 1) +
    nose('#c4936e') +
    mouth('#a8465e', 7, 13) +
    '<circle cx="174" cy="114" r="5" fill="#e2b13c"/><circle cx="174" cy="114" r="2" fill="#a8761c"/>'
  );

  /* ---------------------------------------------------------------
     СТИЛИ КАРТОЧЕК ВЫБОРА ТРЕНЕРА

     Их не было нигде. ensureStyles() в chess-teacher-ui-core.js
     оформляет плашку «сейчас выбран» (.tui-current) и подпись в
     разборе (.tui-inline), а сетку выбора — .tui-picker, .tui-card и
     то, что внутри карточки, — не оформляет никто. В sky.css этих
     правил тоже нет.

     Из-за этого карточка выпадала в поток по умолчанию: <b>, <span> и
     <small> — строчные элементы, и без display:block имя, роль и
     строгость слипались в «Атакующий ОгоньАтака и инициативаСредний».
     Портрет при этом растягивался во всю ширину карточки, потому что
     .tui-face не имел размера.

     Кладу правила сюда, а не в sky.css, намеренно: этот файл отвечает
     за то, как выглядят тренеры, и чистка таблицы стилей его не
     зацепит. Если правила когда-нибудь появятся и в sky.css, они
     просто перекроют эти — конфликта не будет.
     --------------------------------------------------------------- */
  function styles() {
    if (document.getElementById('sky-coach-card-styles')) return;
    const st = document.createElement('style');
    st.id = 'sky-coach-card-styles';
    st.textContent = `
      .tui-picker{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}
      .tui-card{display:flex;align-items:center;gap:12px;min-width:0;padding:12px;
        border:1px solid var(--line);border-radius:15px;background:var(--panel);
        color:var(--ink);text-align:left;cursor:pointer;
        transition:border-color .15s,background .15s,transform .15s,box-shadow .15s}
      .tui-card:hover{transform:translateY(-2px);border-color:var(--line-2)}
      .tui-card:active{transform:translateY(0)}
      .tui-card.active{border-color:var(--m-chess);background:var(--m-chess-soft);
        box-shadow:0 0 0 2px color-mix(in srgb,var(--m-chess) 14%,transparent)}
      /* Галочка на выбранном: цвет рамки на мелком экране почти не
         виден, а выбор должен читаться сразу. */
      .tui-card.active::after{content:'✓';position:absolute;right:9px;top:9px;
        width:18px;height:18px;border-radius:50%;display:grid;place-items:center;
        background:var(--m-chess);color:#fff;font-size:10px;font-weight:900}
      .tui-card-info{min-width:0;flex:1}
      .tui-card-info b{display:block;font-size:13px;font-weight:900;line-height:1.2;color:var(--ink)}
      .tui-card-info span{display:block;font-size:11px;line-height:1.3;color:var(--muted);margin-top:3px}
      .tui-card-info small{display:block;font-size:10px;line-height:1;color:var(--warn);
        letter-spacing:.06em;margin-top:5px;font-weight:800}
      .tui-face{width:48px;height:48px;flex:0 0 48px;border-radius:50%;overflow:hidden}
      .tui-face svg{display:block;width:100%;height:100%}
      @media(max-width:1000px){.tui-picker{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:560px){.tui-picker{grid-template-columns:1fr}.tui-card{padding:10px;gap:10px}}
    `;
    document.head.appendChild(st);
  }

  /* ---------------------------------------------------------------
     Подстановка. Ядро отдаёт FACES по ссылке, поэтому меняем объект
     на месте — новые ключи увидят и те части интерфейса, что уже
     держат эту ссылку у себя.
     --------------------------------------------------------------- */
  let applied = false;

  function apply() {
    styles();
    const UI = window.ChessTeacherUI;
    if (!UI || !UI.FACES) return false;
    Object.keys(P).forEach(id => { UI.FACES[id] = P[id]; });
    applied = true;
    repaint();
    return true;
  }

  /* Часть интерфейса уже нарисована на старых аватарках — просим
     перерисовать. renderPicker перерисовывает выборы тренера,
     refreshCurrentTeachers — плашки «сейчас выбран». */
  function repaint() {
    const UI = window.ChessTeacherUI;
    if (!UI) return;
    document.querySelectorAll('.tui-picker').forEach(pk => {
      const host = pk.parentElement;
      if (host && typeof UI.renderPicker === 'function') {
        try { UI.renderPicker(host); } catch (_) {}
      }
    });
    if (typeof UI.refreshCurrentTeachers === 'function') {
      try { UI.refreshCurrentTeachers(); } catch (_) {}
    }
  }

  /* Ядро инициализируется через setTimeout(…, 0), а панель выбора
     тренера появляется вообще только когда человек откроет «Игра с
     тренером». Поэтому пробуем несколько раз и потом следим за
     появлением новых карточек. */
  (function wait(n) {
    if (apply()) return;
    if (n > 40) return;
    setTimeout(() => wait(n + 1), 100);
  })(0);

  const mo = new MutationObserver(records => {
    if (!applied) return;
    for (const r of records) {
      for (const node of r.addedNodes) {
        if (node.nodeType !== 1) continue;
        /* Перерисовываем только если появились карточки со старой
           картинкой — иначе наблюдатель зациклится сам на себе. */
        if (node.matches && (node.matches('.tui-picker') || node.querySelector) &&
            (node.matches('.tui-picker') || node.querySelector('.tui-picker'))) {
          const UI = window.ChessTeacherUI;
          if (UI && UI.FACES && UI.FACES['coach-fire'] !== P['coach-fire']) apply();
          return;
        }
      }
    }
  });
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });

  window.SkyCoachPortraits = { apply, portraits: P };
})();
