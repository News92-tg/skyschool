/*
  Service Worker SkyySchool — офлайн-режим.

  Идея простая: при первом заходе (с интернетом) браузер один раз
  скачивает и сохраняет «оболочку» приложения — все страницы, стили,
  скрипты и базы заданий. После этого сайт открывается и работает
  без сети: заходить в тренажёр, решать задания, играть в шахматы
  с ботом, вести трекеры — всё это не требует сервера, только
  Supabase-синхронизация (вход, публикация ДЗ, чат) ждёт интернет.

  Версия кэша бампается при каждом заметном обновлении файлов —
  это заставляет браузер скачать всё заново и подчистить старое.
*/
'use strict';

const CACHE_VERSION = 'sky-v2';
const STATIC_CACHE = CACHE_VERSION + '-static';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

/* Оболочка приложения: без этого списка сайт не откроется офлайн. */
const PRECACHE_URLS = [
  './',
  'index.html', 'trainer.html', 'kids.html', 'chess.html',
  'teachers.html', 'homework.html', 'life.html', 'plan.html', 'tools.html', 'photo.html',
  'offline.html', 'manifest.json',

  'assets/config.js', 'assets/core.js', 'assets/db.js', 'assets/auth.js',
  'assets/chess-engine.js', 'assets/chess-ai.js', 'assets/chess-review.js',
  'assets/match3.js', 'assets/python-editor.js',
  'assets/ai-teachers.js', 'data/ai-teachers.js', 'assets/sky.css',
  'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png',

  'data/bank-math.js', 'data/bank-informatics.js', 'data/bank-russian.js',
  'data/bank-physics.js', 'data/bank-biology.js', 'data/bank-chemistry.js',
  'data/bank-geography.js', 'data/bank-social.js', 'data/bank-history.js',
  'data/bank-english.js', 'data/bank-polish.js', 'data/bank-spanish.js', 'data/bank-german.js',
  'data/bank-kids.js', 'data/chess-lessons.js', 'data/chess-puzzles.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(err => {
        /* Один отсутствующий файл не должен ломать всю установку —
           просто пробуем закэшировать по одному и не падаем целиком. */
        console.warn('SW: addAll failed, retrying one by one', err);
        return caches.open(STATIC_CACHE).then(cache =>
          Promise.all(PRECACHE_URLS.map(u => cache.add(u).catch(() => {}))));
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('sky-') && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* Адреса, куда мы НЕ лезем со своим кэшем: живые данные и запись
   должны всегда идти в сеть напрямую (Supabase, ИИ-разбор, воркер). */
function isLiveEndpoint(url) {
  return /supabase\.co|supabase\.in|deepseek\.com|\/functions\/v1\//.test(url.href)
      || url.pathname.includes('/rest/') || url.pathname.includes('/auth/v1/');
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;              // запись всегда напрямую в сеть

  const url = new URL(req.url);
  if (isLiveEndpoint(url)) return;                // Supabase/ИИ — не кэшируем и не перехватываем

  /* Переход по страницам: пробуем сеть (свежая версия), при неудаче —
     кэш, при полном провале — офлайн-заглушка. */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then(cached => cached || caches.match('offline.html'))
        )
    );
    return;
  }

  /* Свой источник (страницы/скрипты/стили/базы заданий): кэш в
     приоритете — мгновенно и работает офлайн, а в фоне подтягиваем
     свежую версию на следующий раз (stale-while-revalidate). */
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (res && res.ok) caches.open(STATIC_CACHE).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => null);
        return cached || network || caches.match('offline.html');
      })
    );
    return;
  }

  /* Чужой источник (шрифты Google, Pyodide с jsdelivr и т.п.):
     тоже кэшируем после первой успешной загрузки, чтобы Python-
     песочница и шрифты работали офлайн со второго раза. */
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.ok) caches.open(RUNTIME_CACHE).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => cached);
    })
  );
});
