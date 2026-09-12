/* ============================================================
   PythonEditor — тонкая обёртка над Pyodide (Python, скомпилированный
   в WebAssembly, выполняется прямо в браузере, без сервера).

   Версия Pyodide (v0.26.4) намеренно совпадает с той, что уже
   использует песочница в разделе «Инструменты» (tools.html): если
   версии разные, браузер качает ДВЕ отдельных копии рантайма (это
   ~10–15 МБ каждая) и офлайн-кэш дублируется. Одна и та же версия —
   один раз скачали, работает из обоих мест.

   Использование:
     const r = await PythonEditor.runPython('print(2 + 2)');
     // r.output — весь stdout построчно, склеенный через \n
     // r.error  — текст ошибки, если что-то пошло не так (иначе undefined)
     // r.result — значение последнего выражения (repr), если есть
   ============================================================ */
(function (root) {
  'use strict';

  const PYODIDE_VERSION = '0.26.4';
  const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VERSION + '/full/';

  let pyodide = null;      // готовый экземпляр
  let loadingPromise = null; // промис первой загрузки, чтобы не грузить дважды параллельно

  /* Загружаем скрипт Pyodide и инициализируем интерпретатор.
     onProgress(msg) — необязательный колбэк для статус-строки в UI. */
  function initPyodide(onProgress) {
    if (pyodide) return Promise.resolve(pyodide);
    if (loadingPromise) return loadingPromise;

    const report = (m) => { if (typeof onProgress === 'function') onProgress(m); };

    loadingPromise = (async () => {
      report('Загрузка Python…');

      // грузим loader-скрипт, только если его ещё нет на странице
      if (typeof root.loadPyodide !== 'function') {
        await new Promise((resolve, reject) => {
          const existing = document.querySelector('script[data-pyodide-loader]');
          if (existing) {
            existing.addEventListener('load', resolve);
            existing.addEventListener('error', reject);
            return;
          }
          const script = document.createElement('script');
          script.src = PYODIDE_BASE + 'pyodide.js';
          script.dataset.pyodideLoader = '1';
          script.onload = resolve;
          script.onerror = () => reject(new Error('network'));
          document.head.appendChild(script);
        });
      }

      report('Запуск интерпретатора…');
      pyodide = await root.loadPyodide({ indexURL: PYODIDE_BASE });
      report('Python готов');
      return pyodide;
    })().catch((e) => {
      // сбрасываем, чтобы следующая попытка не залипла на неудачном промисе
      loadingPromise = null;
      throw e;
    });

    return loadingPromise;
  }

  /* Выполняет код, возвращает {output, error?, result?}.
     Ошибку сети/загрузки отличаем от ошибки в самом коде — честно
     называем причину, а не просто "не сработало". */
  async function runPython(code, onProgress) {
    let py;
    try {
      py = await initPyodide(onProgress);
    } catch (e) {
      return { output: '', error: 'Python-редактор требует интернета при первом запуске: среда выполнения ещё не скачана, а сеть недоступна или заблокирована.' };
    }

    const lines = [];
    py.setStdout({ batched: (s) => lines.push(s) });
    py.setStderr({ batched: (s) => lines.push('⚠ ' + s) });

    try {
      const result = await py.runPythonAsync(code);
      return {
        output: lines.join('\n'),
        result: (result !== undefined && result !== null) ? String(result) : ''
      };
    } catch (e) {
      return { output: lines.join('\n'), error: String(e) };
    }
  }

  function isReady() { return !!pyodide; }

  root.PythonEditor = { initPyodide, runPython, isReady, PYODIDE_VERSION };
})(window);
