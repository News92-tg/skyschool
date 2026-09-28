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

  /* --- 2б. Worker проверки домашки (news92-orders) ---
     «Домашка по фото»: проверка по фото и текстом, тарифы и лимиты
     (/api/check-photo, /api/check-text, /api/limits). Тоже адрес, не
     ключ: ключи Z.AI и Groq — только в секретах Worker.
     Пусто — берётся AI_BASE. */
  AI_BASE_ORDERS: 'https://news92-orders.almazpro0927.workers.dev/',

  /* --- 3. Ссылка на сайт студии (для перехода из шапки) --- */
  STUDIO_URL: 'https://news92-tg.github.io/Design-Studio/',

  /* --- 4. Название и почта для подвала --- */
  BRAND: 'SkyySchool',
  CONTACT: 'https://t.me/news_92',

  /* --- 5. Цена токенов для счётчика «Потрачено» на «Домашке по фото» ---
     Рубли за 1 млн токенов: input — что ушло в модель (фото и
     промт), output — ответ модели. glm-4.6v-flash бесплатная, поэтому
     нули. Для glm-4.6v-flashx по ценам Z.AI (0,02 $ и 0,21 $ за 1 млн)
     при курсе ~80 ₽ это примерно { input: 1.6, output: 17 }. */
  TOKEN_PRICE_RUB: { input: 0, output: 0 }
};
