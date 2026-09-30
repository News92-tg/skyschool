/*
  Service Worker SkyySchool — safe offline shell.
  Live API requests bypass the worker. Static requests use network-first
  while online and fall back to the cache offline. We deliberately avoid
  cloning a Response after it may have been consumed: this prevents the
  browser error "Response body is already used" seen in DevTools.
*/
'use strict';
 
const CACHE_VERSION = 'sky-v4';
const STATIC_CACHE = CACHE_VERSION + '-static';
 
const PRECACHE_URLS = [
  './',
  'index.html','trainer.html','kids.html','chess.html','teachers.html','homework.html','life.html','plan.html','tools.html','photo.html','offline.html','exam.html','essay.html','parent.html','manifest.json',
  'assets/config.js','assets/core.js','assets/streaks.js','assets/db.js','assets/auth.js','assets/errors.js',
  'assets/chess-engine.js','assets/chess-ai.js','assets/chess-review.js',
  /* бот в фоновом потоке: сам поток и ядро, которое он подгружает */
  'assets/chess-ai-worker.js','assets/chess-ai-core.js','assets/chess-play-ui.js',
  'assets/chess-teacher-ui.js','assets/chess-teacher-ui-core.js',
  'assets/chess-game-modes.js','assets/chess-puzzle-coach.js','assets/chess-game-flow.js',
  'assets/chess-lessons-system.js','assets/chess-lessons-fallback.js','assets/chess-lessons-polish-v2.js','assets/chess-runtime-hardening.js',
  'assets/match3.js','assets/python-editor.js','assets/ai-teachers.js','data/ai-teachers.js','assets/sky.css',
  'assets/photo-api.js','assets/photo-teacher.js','assets/photo-text.js','assets/grading-criteria.js',
  'admin.html','assets/admin.js',
  'collections.html','collection.html','assets/collection-common.js','assets/collections.js','assets/collection.js',
  'fast-check.html','assets/fast-check.js','assets/limits.js',
  'auth.html','assets/auth-ui.js','onboarding.html','assets/onboarding.js','profile.html','assets/profile.js','assets/telegram.js','assets/submissions.js',
  'analytics.html','assets/analytics.js',
  'assets/icon-192.png','assets/icon-512.png','assets/apple-touch-icon.png',
  'data/bank-math.js','data/bank-informatics.js','data/bank-russian.js','data/bank-physics.js','data/bank-biology.js','data/bank-chemistry.js',
  'data/bank-geography.js','data/bank-social.js','data/bank-history.js','data/bank-english.js','data/bank-polish.js','data/bank-spanish.js','data/bank-german.js',
  'data/bank-kids.js','data/chess-lessons.js','data/chess-puzzles.js',
  /* всё, что подключают страницы ниже; полноту списка проверяет
     scripts/test-offline.js — новая страница без записи здесь его уронит */
  'test.html','trackers.html','body.html','psychologist.html','classroom.html','headteacher.html','pe.html','russian-for-en.html',
  'assets/nav-overflow.js','assets/ai-fallback.js','assets/roles.js','assets/trackers.js','assets/insights.js',
  'assets/body.js','assets/psychologist.js','assets/chess-progress.js','assets/speech.js',
  'assets/russian-en.js','assets/russian-en.css','data/bank-russian-en.js','data/iq-test.js','data/oge-bank.js'
];
 
self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache=>Promise.all(PRECACHE_URLS.map(url=>cache.add(url).catch(()=>null))))
      .then(()=>self.skipWaiting())
  );
});
 
self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith('sky-')&&k!==STATIC_CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});
 
function isLiveEndpoint(url){
  return /supabase\.(co|in)|deepseek\.com|\/functions\/v1\//.test(url.href)
      || url.pathname.includes('/rest/') || url.pathname.includes('/auth/v1/');
}
 
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(isLiveEndpoint(url))return;
  if(url.origin!==self.location.origin)return;
 
  /* Online: always return the fresh network response.
     Offline: serve the cached response. No Response.clone()/cache.put()
     is performed in the fetch path, eliminating body-reuse races. */
  event.respondWith(
    fetch(req).catch(()=>caches.match(req).then(cached=>cached||caches.match('offline.html')))
  );
});
