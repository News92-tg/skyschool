/* ============================================================
   SkyySchool — НАСТРОЙКИ
   Это единственный файл, который нужно править руками.
   Всё остальное работает само.
   ============================================================ */

window.SKY_CONFIG = {

  /* --- 1. Supabase: аккаунты, учителя, домашние задания ---
     Берётся в панели Supabase: Project Settings → API.
     Нужны два значения: Project URL и ключ anon (он же public).

     ВАЖНО про безопасность: ключ anon/publicable публичный ПО ЗАМЫСЛУ — он лежит
     в коде любого сайта на Supabase, и это нормально. Доступ к данным
     ограничивают не им, а правилами RLS на стороне базы (они в
     sql/schema.sql). Ключ service_role / secret — другое дело: он даёт полный
     доступ и в файлы сайта попадать не должен НИКОГДА.

     Пока поля пустые, сайт работает на этом устройстве без аккаунтов. */
  SUPABASE_URL: 'https://gtznaybjvqwhbybhxwjq.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_mqqeuIR7mY9qM8DEP0jWQA_f5nva7gq',

  /* --- 2. Разбор от ИИ ---
     Сюда идёт АДРЕС Cloudflare Worker, а не ключ DeepSeek.
     Правильно:   'https://sky-ai.ваш-логин.workers.dev'
     Неправильно: 'sk-...'  ← ключ в браузере виден всем, кто откроет
                              исходник страницы, и спишет ваш баланс.
     Как развернуть Worker — в README, раздел «Разбор от ИИ». */
  AI_BASE: 'https://news92-orders.almazpro0927.workers.dev/',

  /* --- 3. Ссылка на сайт студии (для перехода из шапки) --- */
  STUDIO_URL: 'https://news92-tg.github.io/Design-Studio/',

  /* --- 4. Название и почта для подвала --- */
  BRAND: 'SkyySchool',
  CONTACT: 'https://t.me/news_92'
};
