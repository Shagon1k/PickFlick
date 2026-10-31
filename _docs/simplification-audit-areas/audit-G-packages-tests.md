# Area: G — Shared packages and test infrastructure

Read: `packages/contracts/**` (все схемы, типы, константы, тесты), `packages/database/**`
(`prisma/schema.prisma`, `src/**` включая `cli/` и `__tests__/`, README; миграции — только поиском
CHECK/UNIQUE/TRIGGER/RAISE, чтобы сверить инварианты), `packages/eslint-config/**`, корневые
`eslint.config.mjs`, `stylelint.config.mjs`, `prettier.config.mjs`, `.prettierignore`, `knip.jsonc`,
`tsconfig.json`, `packages/config/tsconfig/*.json`, `vitest*.config.ts`, три `playwright.*.config.ts`,
`apps/backend/src/testing/**` (+ `tsconfig.build.json`), `tests/ui/start-frontend-with-mock-api.ts`,
`mock-http.ts`, `shell-fixtures.ts`, `settle.ts`, `viewports.ts`, `session-facts.ts`,
`tests/journeys/start-journey-stack.ts`, `club-to-nomination.spec.ts`; остальные `tests/ui/*.ts`
mock-домены и `*.spec.ts` — поиском по структуре (cookie-хелперы, `includes(…)`, module-level state).
Для проверки инвариантов прочитаны заголовки тестов в `rating`, `past-sessions`, `selection`,
`roster`, `nomination-deadlines`, `personal-rating` int-спеках.
Not read: `packages/config/src/*` (environment/email-matrix — зона notifications-infra и решение
«env не трогаем»); тела mock-обработчиков `tests/ui/*.ts` построчно не читал — их судьбу решает #27.

## Must fix

### G1. После повторного входа три страницы Club теряют адрес возврата (`packages/contracts/src/auth/return-target.ts:6-14`)

- Case: auth-сессия истекла, пользователь открывает `/clubs/<id>/members`.
  `members/page.tsx:29` вызывает `buildLoginPath('/clubs/<id>/members')`, но `resolveAuthReturnTarget`
  не находит путь в allowlist (регэксп Club допускает только `''|/settings|/sessions/new|/achievements`)
  и подставляет `/app`. После входа человек попадает на `/app`, а не на Members. То же для
  `/clubs/<id>/sessions` (`(hub)/sessions/page.tsx:32`) и `/clubs/<id>/sessions/past/new`
  (`sessions/past/new/page.tsx:29`). Тест `return-target.spec.ts` эти маршруты не перечисляет.
- Fix: расширить один регэксп до
  `(?:\/settings|\/members|\/sessions(?:\/new|\/past\/new)?|\/achievements)?` и добавить три пути в
  список «should keep» спеки. Заодно вынести UUID-фрагмент (повторён 4 раза) в одну константу.
- Losing functionality: нет. Allowlist остаётся закрытым: добавлены только реальные маршруты без query.

## Should fix

### G2. Аудит-события Club вычисляются и отдаются, но нигде не показываются (`packages/contracts/src/clubs/club.types.ts:15,60-93,110`, `apps/backend/src/modules/clubs/clubs.service.ts:104-165`)

- Case: каждый `GET /clubs/:id/settings` от Admin выполняет лишний запрос `clubAuditEvent.findMany`
  и отдаёт `auditEvents`. Фронтенд это поле не читает: `git grep auditEvents apps/frontend` пуст.
  DESIGN DES-011 прямо говорит: «Audit events are not shown». Вокруг этого держатся
  `CLUB_AUDIT_ACTIONS` (копия Prisma-enum `ClubAuditAction`, её надо обновлять при каждом новом
  действии), `TClubAuditAction`, `IClubAuditEvent`, константа `AUDIT_EVENTS_LIMIT` и разрешение
  `viewAudit` (`club-permissions.ts:29`). `viewAudit` вычисляется, но не читается: сам запрос гейтится
  отдельным `role === 'ADMIN'`, то есть одно правило записано двумя способами.
- Fix: удалить `auditEvents` из `IClubSettings` и из `getSettings`, `CLUB_AUDIT_ACTIONS`/
  `TClubAuditAction`/`IClubAuditEvent`, `viewAudit` из `CLUB_PERMISSIONS` и `club-permissions.ts`.
  Проверки в `clubs.int.spec.ts:104,130` перевести на `api.prisma.clubAuditEvent`. Убрать поле из
  `tests/ui/club-projections.ts:83`.
- Losing functionality: нет. Аудит по-прежнему пишется в `ClubAuditEvent` (инвариант AGENTS.md);
  пропадает только невидимое поле ответа. Если просмотр аудита понадобится (App Admin, Phase 22+),
  он вернётся вместе с экраном. Пересекается с зоной clubs.

### G3. Две противоречащие договорённости о форме ответов API; часть «валидирующих» схем никогда не выполняется (`packages/contracts/README.md:8`, `_docs/adding-a-feature.md:38`, `.agent-docs/rules/typescript.md:90`)

- Case: README и adding-a-feature требуют «Responses are plain interfaces», а typescript.md — «Shared
  request/response schemas». В коде есть оба варианта: `IClubHub` и `ISessionRoster` — интерфейсы,
  а `sessionSchema`, `librarySchema`, `achievementsSchema` и другие — zod. Новичок не знает, что
  писать. Хуже, что часть response-схем нигде не парсится, но выглядит как защита:
    - `movieDetailsResponseSchema.links.imdb/kinopoisk/letterboxd` (`movie.schema.ts:241-256`) с
      регэкспами похожи на проверку `href`, но не вызываются ни в API, ни в тестах. Ссылки собираются
      строкой в `movies.service.ts:116,200`.
    - `invitationPreviewSchema` используется только в `invitation.schema.spec.ts:16-23`. Тест «should
      reject an unsafe preview» проверяет схему, которую API не применяет.
    - `sessionInvitationPreviewSchema`, `pastSessionMembersSchema`, `sessionProgressSchema`, `ratingSchema`,
      `selectionSchema`, `nominationsSchema` нужны только ради `z.infer`.
- Fix: зафиксировать одно правило в трёх документах (одна строка в каждом): «Ответ — zod-схема,
  если int-тест его парсит; иначе — интерфейс». В `movies.service.spec.ts`, который уже строит
  `links`, добавить `movieDetailsResponseSchema.parse(...)`, чтобы регэкспы реально проверялись.
  Из `invitation.schema.spec.ts` убрать проверку response-схемы (или парсить ответ preview в
  `club-invitations.int.spec`).
- Losing functionality: нет. Меняются документация и тесты, а проверка ссылок становится настоящей.

### G4. Спеки отката миграций проверяют разовый backfill, а не живую схему (`packages/database/src/__tests__/{selection-ballots,movie-cache,past-nomination-authors,movie-sources,achievements}-migration.int.spec.ts`, ~470 строк)

- Case: каждая спека создаёт временную схему, накатывает SQL **одной старой** миграции и проверяет
  перенос данных или блокировки на момент выката. Все эти миграции уже применены на UAT,
  production ещё не создана и стартует с пустых таблиц, так что эти backfill больше нигде не
  выполнятся. При этом спеки не ловят дрейф живой схемы. Например, будущая миграция
  `DROP TRIGGER "AchievementAward_immutable"` оставит `achievements-migration.int.spec.ts:84-89`
  зелёным: он накатывает только `20261030000000`. Реальную защиту даёт
  `achievements.int.spec.ts:129`. Кроме того, шаблон «scratch-схема + чтение SQL + вырезание
  BEGIN/COMMIT» скопирован 5 раз в двух разных вариантах (`replaceAll(/^(BEGIN|COMMIT);$/gmu)` и
  `replace(/^BEGIN;/u)`).
- Fix: удалить четыре backfill-спеки (`selection-ballots`, `movie-cache`, `past-nomination-authors`,
  `movie-sources`). Из `achievements-migration` перенести две проверки, у которых нет аналога на
  живой БД (`num_nonnulls("userId","clubId") = 1`, дедупликация по `key/version` в каждом scope), в
  `constraints.int.spec.ts` через существующий `expectConstraint`. Сам файл удалить.
- Losing functionality: нет. Продуктового поведения эти тесты не охраняют; история миграций не
  трогается. Нужно подтверждение владельца: это удаление тестов.

### G5. Вход в UI-моках скопирован 15 раз, а cookie-литерал — 61 раз (`tests/ui/*.spec.ts`)

- Case: в 15 спеках своя `async function authenticate/signIn(context, …)`: `club-hub.spec.ts:11`,
  `club-members.spec.ts:8`, `club-settings.spec.ts:9`, `nominations.spec.ts:8`, `rating.spec.ts:8`,
  … В 26 файлах 61 раз вручную собирается `{ name: 'pickflick.session_token', value, domain, path }`.
  Если поменяется префикс cookie Better Auth или домен, придётся править 26 файлов. Варианты уже
  разошлись: в одних `url`, в других `domain/path`, `club-hub.spec.ts:96` добавляет `randomUUID()`
  к токену, остальные нет (см. G6).
- Fix: `tests/ui/mock-session.ts` с `SESSION_COOKIE = 'pickflick.session_token'` и
  `authenticate(context, scenario)`; локальные копии удалить. Делать после #27 (удаления mock-спек),
  чтобы не трогать файлы под снос.
- Losing functionality: нет. Тот же cookie, одна реализация.

### G6. Состояние mock-API не сбрасывается между попытками, а сценарий задаётся подстрокой токена (extends #27; `tests/ui/start-frontend-with-mock-api.ts:39-41,171-173,343`, `tests/ui/*.ts`)

- Case: 20+ module-level `Map`/`Set` (`failedHubLoads`, `failedInvitationRefreshes`,
  `failedReads` в `achievements.ts:5`/`club-ratings.ts:9`, `failedLoads` в `notifications.ts:7`,
  `states`, `saved`, …) хранятся по токену всё время работы сервера. В CI `retries: 1`
  (`playwright.ui.config.ts:27`). Пример: `club-invitations.spec.ts:239` входит с фиксированным
  `'refresh-failure'`. Если первая попытка упала по другой причине, повтор уже не получит
  одноразовый 503, потому что токен сохранён в `failedInvitationRefreshes`. Тест падает с
  посторонней ошибкой, а исходная причина теряется. Плюс около 107 проверок `token.includes('…')`:
  сценарии кодируются подстроками, и порядок веток в `hubClubs` (`:57-75`) решает, какая подстрока
  победит.
- Fix: в общем `authenticate` из G5 всегда добавлять `-${randomUUID()}` к сценарию. Тогда каждая
  попытка получает свежее состояние, без reset-эндпоинта. Подстрочные сценарии сократятся вместе с #27.
- Losing functionality: нет.

### G7. Journeys сами собирают вход в 8 файлах (extends #63; `tests/journeys/*.spec.ts`)

- Case: `newContext` → `addCookies(await backend.cookiesFor(userId, '127.0.0.1'))` повторён в
  `achievements:59,83`, `library:53`, `past-session:87,97`, `personal-rating:61`, `rating:64`,
  `selection:80`, `watching:32`, `watchlist:34`. Только `club-to-nomination.spec.ts:26-34` даёт каждому
  посетителю свой `x-forwarded-for`, чтобы не упереться в лимит Better Auth. Остальные полагаются на
  очистку `authRateLimit` в `connectJourneyBackend` (`journeys.ts:53`). Два способа обойти один и
  тот же лимит.
- Fix: перенести `signedInPage(browser, displayName)` из `club-to-nomination.spec.ts` в общий
  `tests/journeys/session.ts` (или в `IJourneyBackend`) и использовать везде, вместе с #63.
- Losing functionality: нет.

## Nice to have

### G8. Проверки ограничений БД проходят при любой ошибке (`packages/database/src/__tests__/session.int.spec.ts:175-177,212,218,238,250,259,262,267,272`; `apps/backend/src/modules/sessions/rating/__tests__/rating.int.spec.ts:263-291`)

- Case: `.rejects.toThrow()` без имени. Пример: `session.int.spec.ts:272` должен ловить
  `SessionInvite_response_check`, но пройдёт и от любой другой ошибки вставки, например от FK, если
  поменяют фикстуру. В том же пакете уже есть `expectConstraint(action, name)`
  (`constraints.int.spec.ts:37`).
- Fix: передавать имя ограничения или текст триггера (`'Session_selection_scale_check'`,
  `'SessionInvite_digest_check'`, `'immutable'`, …).
- Losing functionality: нет.

### G9. Мёртвые реэкспорты `@pickflick/database` (`packages/database/src/index.ts:1,4-14`)

- Case: `checkDatabaseReadiness` используют только `cli/seed-release.ts` (импорт из `../client.js`)
  и `index.spec.ts`. Из 9 enum-типов снаружи нужен только `AppRole` (`auth.types.ts:1`).
  `ClubAuditAction`, `ClubLifecycle`, `ClubRole`, `MembershipStatus`, `SessionParticipantStatus`,
  `SessionPhase`, `SessionType`, `UserStatus` не импортирует никто. knip их не видит: экспорт
  entry-файла пакета он считает публичным.
- Fix: оставить `export type { AppRole }`, убрать остальное; `index.spec.ts` импортирует
  `checkDatabaseReadiness` из `../client.js`.
- Losing functionality: нет.

### G10. Значения по умолчанию в БД противоречат правилу «новые Club начинаются с 0» (`packages/database/prisma/schema.prisma:175-176`, `src/cli/seed.ts:8,31-40`)

- Case: `selectionScaleMin @default(1)`, `selectionScaleMax @default(5)`. Любой Club, созданный без
  явной шкалы (seed `create`, `prisma.club.create` в int-спеках), получает `1..5`, хотя ROADMAP
  §Selection требует `0..N` для новых Club. Продуктовый код шкалу передаёт всегда, так что
  ошибка видна только в данных тестов и сида.
- Fix: новой миграцией (историю не трогаем) убрать оба DEFAULT. Тогда создание без шкалы падает
  явно. Сид передаёт `selectionScaleMin: 0` или оставляет `1` осознанно — в этом случае комментарий в
  `seed.ts:8` объясняет причину.
- Losing functionality: нет. Хранимые `1` остаются валидными (CHECK `IN (0,1)` не меняется).

### G11. Список фаз Session и состояний приглашения описан в нескольких местах (`packages/contracts/src/clubs/club.types.ts:131`, `sessions/session.schema.ts:12-21,79`, `sessions/roster.schema.ts:46`, `clubs/invitation.schema.ts:38`)

- Case: фазы перечислены в `IClubHubSession.phase` (union) и в `sessionSchema.phase` (`z.enum`), а
  хелперы принимают `string`. Вызов `isBlockingSessionPhase('WATCHNG')` компилируется и молча
  возвращает `false`. Состояние приглашения `'pending' | 'expired' | …` записано дважды.
- Fix: `SESSION_PHASES` + `sessionPhaseSchema` + `TSessionPhase` один раз; хелперы принимают
  `TSessionPhase`; `invitation.state: IManagedInvitation['state']`.
- Losing functionality: нет.

### G12. Схема нижней границы шкалы Selection скопирована 4 раза (extends #40/#74; `club.schema.ts:17`, `past-selection.schema.ts:7-8`, `selection.schema.ts:41-42,66-67`)

- Case: `z.union([z.literal(0), z.literal(1)])` записано четыре раза; в `past-selection.schema.ts:8`
  стоит `.max(10)` вместо `CLUB_SELECTION_SCALE_CEILING`. Если потолок поменяется, импорт Past
  Session будет принимать старую границу.
- Fix: `selectionScaleMinSchema`/`selectionScaleMaxSchema` в `club.schema.ts`, использовать везде.
- Losing functionality: нет.

### G13. «Однострочный» текст пропускает разделители строк Unicode и C1-управляющие символы (`packages/contracts/src/common/text.ts:9-13,22`)

- Case: `singleLineText` отвечает «Use a single line of text» только на `\r`/`\n`. Название Club
  `"Midnight Society"` или `"A\u0085B"` (NEL) проходит валидацию и в текстовом письме или
  превью приглашения выводится в две строки. `isSafeText` отсекает только `< 0x20` и `0x7F`, а весь
  диапазон C1 `0x80–0x9F` пропускает.
- Fix: в `isSafeText` отклонять `\p{Cc}` кроме `\t`/`\n`; в `singleLineText` — ещё и `  `
  (`/[\r\n  ]/u`).
- Losing functionality: нет. Такие символы в именах и заметках не нужны.

### G14. Тестовый код backend попадает в production-образ (`apps/backend/tsconfig.build.json:9`)

- Case: из сборки исключён только `src/**/__tests__/**`, поэтому `dist/testing/integration.js` и
  `journeys.js` уходят в образ (`Dockerfile:25,65`). Там лежит подмена `AuthService`, которая
  доверяет заголовку `x-test-user`, и импорт devDependency `@nestjs/testing`. Сейчас этот код
  ничто не загружает, но он лежит в рантайме.
- Fix: `"exclude": ["src/**/__tests__/**", "src/testing/**"]`.
- Losing functionality: нет. Int-спеки и journeys запускаются из исходников через vitest/tsx.

### G15. Сообщения ESLint ссылаются на несуществующий алиас `@/` (`packages/eslint-config/base.mjs:157,161`)

- Case: «Use the UI kit in @/components/ui», «Import through the @/ alias», хотя в репозитории
  только `#`-алиасы (AGENTS.md, `vitest.config.ts:10-16`, ни одного `@/` в `apps/frontend/src`).
  Агент или новичок пойдёт писать `@/…`, и сборка сломается.
- Fix: `#components/ui`, «the `#` folder aliases».
- Losing functionality: нет.

### G16. Мелочи в Playwright-конфигах и mock-сервере (`playwright.ui.config.ts:3,15,41,46`, `tests/ui/start-frontend-with-mock-api.ts:451,455,463`)

- Case: `fullyParallel: true` при `workers: 1` ничего не меняет и вводит в заблуждение. Порты
  41730/42731 записаны и в конфиге, и в сервере: если поменять в одном месте, мок не поднимется.
  Сообщение «The Contact test API did not bind» осталось с тех времён, когда мок обслуживал только
  Contact.
- Fix: убрать `fullyParallel`; сервер читает порты из `BACKEND_INTERNAL_URL`/`PORT` окружения
  `webServer.command` (как `start-journey-stack.ts:4-6` держит их константами в одном месте);
  сообщение — «The mock API did not bind».
- Losing functionality: нет.

### G17. README пакета database — журнал изменений, а не справка (`packages/database/README.md:24-33`)

- Case: абзацы «Migration 25 adds…», «Migration 26 adds…» описывают две миграции из 35. Из
  тестов назван только `constraints.int.spec` и `session.int.spec`. Читатель не поймёт, где
  описаны остальные триггеры (immutable ratings, Past evidence, achievements).
- Fix: заменить журнал одной строкой «инварианты в SQL-миграциях проверяются в
  `constraints.int.spec.ts` и int-спеках владеющих модулей».
- Losing functionality: нет.

Пропущено мелких находок: 2 (тавтологичный тест `index.spec.ts:57-62` и `getClubEntitlements`,
который читает `SYNTHETIC_FIXTURES` в продакшн-коде, `club-tiers.ts:2,20`; второй — это зона clubs,
и там есть комментарий-«почему»).

## Checked and fine

- Инварианты AGENTS.md, требующие БД и сервер плюс тест:
    - один Admin на Club — `Membership_one_active_admin_per_club_key` с тестом;
    - одна блокирующая Session — `Session_one_blocking_per_club_key` с конкурентными тестами в
      `session.int.spec.ts`;
    - Rating без ограничений и не блокирует — тест;
    - шкала — `Club_selection_scale_check`, `Session_selection_scale_check`, `SelectionScore 0..10`,
      сервер сверяет со снимком Session (`selection.int.spec.ts:121`);
    - приглашения в Session не создают Membership и ничего не раскрывают — `session-roster.int.spec.ts:101,127`;
    - идемпотентные и сериализованные автопереходы — `nomination-deadlines.int.spec.ts:252,284`;
    - Session Rating отделён от Personal Rating и неизменяем — триггер `protect_session_rating`,
      тесты в `past-sessions.int.spec.ts:405-430` и `personal-rating.int.spec.ts:90`;
    - неизменяемость Past evidence и наград — тесты на `'immutable'`.
      Анонимизация при удалении аккаунта — будущая фаза.
- `assertSafeSeedOrResetTarget` (имя БД, loopback, запрет `?host=`), `run-prisma` с allowlist
  команд, `reset` только после проверки цели. Всё покрыто `index.spec.ts`.
- `snapshotSessionSettings` берёт строковую блокировку Club перед чтением.
- Ключевые места схемы Prisma: композитные FK `(id, clubId)`/`(id, sessionId)` держат строки в
  пределах одного Club или Session.
- Входные zod-схемы: строгие объекты, `confirmation` литералы, лимиты из констант; URL картинок и
  трейлеров проверены allowlist-ом хостов и тестами.
- ESLint: пороги совпадают с решением владельца; правила boolean-префиксов, UPPER*SNAKE_CASE,
  magic numbers, `handleX`. Префиксов `*`/`#` у приватных членов в коде нет. Stylelint: токены
  цветов, брейкпоинты (двойная запись уже в #72). Prettier, knip, tsconfig-пресеты в порядке.
- `testing/integration.ts`: `removeUsers` удаляет в правильном порядке FK (остальное каскадится);
  `startTestApi` подменяет только storage и auth.
- `journeys.ts` отказывается работать без `APP_ENV=test`, тест на это есть; `start-journey-stack.ts`
  ждёт liveness API.
- `settle.ts`, `viewports.ts` — одна точка правды, как требует `ui-quality.md`.
