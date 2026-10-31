# Area: D — Notifications, workers and infrastructure

Read: `apps/backend/src/modules/notifications/**` (all 19 production files and 8 test files, incl. `email/`),
`apps/backend/src/email-worker.ts`, `deadline-worker.ts`, `deadline-worker-loop.ts` (for context),
`apps/backend/src/modules/email/*` (client used by the worker, context only), `packages/config/**`
(src, tests, tsconfig presets, `scripts/validate.mjs`, README, package.json), `Dockerfile`,
`compose.local.yaml`, `compose.ci.yaml`, `compose.deploy.yaml`, `compose.preview.yaml`, `scripts/**`
(all 9 scripts and 4 tests), `.github/workflows/{ci,deploy-uat,promote-production}.yml`,
`.github/dependabot.yml`, PR/issue templates (skimmed), root `package.json`, `.env.example`,
`pnpm-workspace.yaml`. Requirements: ADR-019, ADR-020, `_docs/email-delivery.md`, `_docs/environment.md`,
`_docs/security.md` (notification/webhook/log parts), `_docs/uat-operations.md` and
`_docs/production-operations.md` (worker/Redis/email parts), ROADMAP Phase 17 and notification policy,
contracts `notifications/*.schema.ts`.
Not read: `_docs/phase-17-notifications.md` beyond the header (temporary phase doc); issue templates only
skimmed (no code).

Уже есть в `_docs/simplification-audit.md` и здесь не повторяется: #1–#9, #28, #29, #33, #41, #49, #57,
#62, #69, #70, #71. Новые места для старых находок помечены «extends #N».

## Must fix

Нет. Багов с неверным результатом, утечек секретов/PII в логах и нарушений ADR-019/020 в этой области не
нашёл (см. «Checked and fine»). Production по-прежнему выключен двумя проверками.

## Should fix

### D1. Правило «BILLING_SERVICE обязателен» записано в трёх местах (`apps/backend/src/modules/notifications/notification-policy.ts:26`, `notifications.service.ts:28`, `email/email-template.ts:25`)

- Case: ROADMAP разрешает и другие обязательные сервисные уведомления («Billing and service notices may be
  mandatory»). Если сделать обязательным, например, `CLUB_INACTIVITY_WARNING` только в
  `getNotificationPolicy`, то `PUT /notifications/preferences` по-прежнему примет `email: false` для него
  (проверка в сервисе знает только `BILLING_SERVICE`), а письмо напишет «You opted in to email updates» и
  покажет ссылку на настройки для обязательного уведомления. Ни один тест этого не поймает: тесты политики
  и шаблона тоже сравнивают с литералом `'BILLING_SERVICE'`.
- Fix: экспортировать из `notification-policy.ts` одну функцию `isMandatoryNotification(event)` и
  использовать её в сервисе (`if (isMandatoryNotification(input.event) && …)`) и в шаблоне. Три строки
  меняются, новых слоёв нет.
- Losing functionality: нет; правило и CHECK-ограничение в БД остаются прежними.

### D2. Нормализация и хэш адреса для suppression продублированы (`email/email-dispatcher.ts:20,120`, `email/email-webhook.service.ts:17,73`)

- Case: dispatcher считает `hashEmailValue(email.trim().toLowerCase())`, webhook — то же выражение
  отдельно. Если одна сторона изменит нормализацию (например, уберёт `trim` или добавит Unicode-нормализацию),
  хэш bounce/complaint из webhook перестанет совпадать с хэшем в dispatcher, и письма на адрес, который
  Resend пометил как bounced, снова пойдут — это нарушает ADR-020 («suppression blocks future email»).
  Тест webhook использует адрес в нижнем регистре без пробелов и такой разъезд не заметит. Плюс
  `email-webhook.service.ts` импортирует весь `email-dispatcher.ts` (с Resend-клиентом) ради хэш-функции.
- Fix: одна функция `hashEmailAddress(address)` (нормализация + sha256) в `email-store.ts`; dispatcher и
  webhook вызывают её. `hashEmailValue` для `requestHash` уходит вместе с #3 (решение «да»).
- Losing functionality: нет; формула хэша та же, существующие строки suppression совпадают.

### D3. Аудитории уведомлений без тестов: `NOMINATION_STALLED`, `ADMIN_TRANSFERRED`, `CLUB_ARCHIVED`/`REACTIVATED`, `SESSION_CANCELLED` (`notification-producers.ts:35-42`, `:63-66`)

- Case: `NOMINATION_STALLED` должен уходить только Admin/Moderator (`audienceFilter`), а
  `ADMIN_TRANSFERRED` — и новому, и бывшему админу (ветка `actorUserId !== subjectUserId`). Если поменять
  местами ветки тернарника на строке 64–66, уведомление о сорванном дедлайне получат обычные участники,
  а при поломке строки 40 бывший админ не узнает о смене роли. `git grep` по тестам: `Notification`-строки
  для этих событий нигде не проверяются; `nomination-deadlines.int.spec.ts` проверяет только старую таблицу
  `NominationDeadlineNotification` (см. D4), `notifications.int.spec.ts` — только `MEMBERSHIP_ROLE_CHANGED`,
  `RATING_OPENED`, `SESSION_STARTED` и награды.
- Fix: один integration-тест в `notifications.int.spec.ts` на `recordAudit`/`recordSessionNotifications`:
  получатели для `NOMINATION_STALLED` (только менеджеры, `occurrence = deadlineVersion`),
  `ADMIN_TRANSFERRED` (оба), `CLUB_ARCHIVED` (все активные), `SESSION_CANCELLED` (только ACCEPTED).
- Losing functionality: нет, только тест.

### D4. Два списка получателей для одного «дедлайн сорван»: write-only таблица `NominationDeadlineNotification` (`apps/backend/src/modules/sessions/nominations/nomination-deadlines.ts:118-138`, `:144-146`)

- Case: при `EMPTY` воркер сначала сам выбирает менеджеров и пишет их в
  `NominationDeadlineDecision.notifications`, а следующей строкой `recordSessionNotifications` тем же
  запросом выбирает их снова и пишет `Notification`. Таблицу `NominationDeadlineNotification` в
  production-коде никто не читает (`git grep`: только запись, cleanup в `testing/integration.ts:98` и
  тесты). Это «durable intent» из фазы 9, который заменил `Notification` фазы 17; `_docs/environment.md:235`
  до сих пор пишет, что «notification transport and inbox delivery are not implemented». Два правила
  аудитории легко разойдутся (например, при добавлении фильтра `club: { deletedAt: null }` в одно место).
- Fix: перестать писать `notifications: { create: recipients }` и удалить локальный запрос получателей;
  таблицу удалить новой миграцией (историю не трогаем). Тесты дедлайна перевести на `Notification`
  (заодно закрывает часть D3). Нужна ваша отметка «?», как у #2, т.к. это схема БД; пересекается с
  областью Sessions.
- Losing functionality: продуктовой — нет, таблицу никто не читает; уходит дублирующая запись о том,
  кому «надо было» сообщить, — эту роль уже выполняют строки `Notification` с тем же `sourceId`.

### D5. `compose.ci.yaml` — пустой оверлей, полностью совпадает с `compose.local.yaml` (`compose.ci.yaml:1-8`, `.github/workflows/ci.yml:161,162,199`)

- Case: оверлей задаёт тот же образ MinIO `sha256:d7c9…`, тот же healthcheck `wget --spider` и тот же
  образ `minio-client sha256:f0dd…`, что уже стоят в `compose.local.yaml:30,41,47`. Новичок ищет, что CI
  «переопределяет», и не находит различий; при обновлении пина нужно править два файла.
- Fix: удалить `compose.ci.yaml`, убрать `-f compose.ci.yaml` из трёх строк `ci.yml`, обновить
  `_docs/environment.md:141,169`.
- Losing functionality: нет; итоговая конфигурация `docker compose config` идентична.

### D6. Секреты Dokploy и Cloudflare Access видны всем шагам UAT-деплоя, включая `pnpm install` и Playwright (`.github/workflows/deploy-uat.yml:30-37`)

- Case: `DOKPLOY_API_TOKEN`, `CF_ACCESS_CLIENT_ID/SECRET` заданы в `env` на уровне job, поэтому они есть в
  окружении сторонних `pnpm/action-setup@v6` (тег, не SHA), разрешённых build-скриптов
  (`prisma`, `esbuild`, `@prisma/engines` в `allowBuilds`), `playwright install` и всего кода зависимостей,
  который грузит `pnpm test:uat`. Скомпрометированное обновление любой из них получает токен, которым можно
  перезапустить/изменить UAT. Нужны они только в шаге «Deploy the UAT Compose resource». Чекаут к тому же
  без `persist-credentials: false`, хотя job ничего не пушит.
- Fix: перенести три переменные `DOKPLOY_*`/`CF_ACCESS_*` в `env:` шага деплоя; добавить
  `persist-credentials: false` в checkout. В `promote-production.yml` job `deploy` не ставит зависимостей —
  его не трогаем.
- Losing functionality: нет; шаг деплоя получает те же значения.

### D7. Live-режим зашит в `compose.deploy.yaml`, а webhook-секрет необязателен на уровне Compose (`compose.deploy.yaml:19,22`)

- Case: `RESEND_DELIVERY_MODE: live` для backend зашит, а `RESEND_WEBHOOK_SECRET: '${…:-}'` допускает
  пустое значение. Если в Dokploy забыть секрет (UAT деплоится автоматически после CI), Compose
  рендерится, `release` применяет миграции, а новый backend падает на `RESEND_WEBHOOK_SECRET is required in
live mode`; `email-worker` и `frontend` ждут здорового backend — UAT лежит уже после миграции. Со всеми
  остальными обязательными значениями файл использует `:?` и падает до старта.
- Fix: `RESEND_WEBHOOK_SECRET: ${RESEND_WEBHOOK_SECRET:?RESEND_WEBHOOK_SECRET is required}`; в
  `scripts/check-compose.sh` для рендера deploy передать синтетическое значение через окружение
  (`RESEND_WEBHOOK_SECRET=check-only docker compose …`; переменная оболочки перекрывает `--env-file`).
- Losing functionality: нет; проверка в API остаётся, Compose просто останавливает деплой раньше.

### D8. Граница email-воркера не проверяется: ни схема окружения, ни собранный entrypoint, ни изоляция секретов (`packages/config/src/environment.schema.ts:269-287`, `notification-environment.schema.ts:11-16`, `scripts/check-compose.sh:30-41`)

- Case: ADR-020 и `_docs/environment.md:82-84` обещают: воркер читает ровно 7 переменных и «receives no
  OAuth, storage, Redis or webhook signing credentials». Если в `compose.deploy.yaml` добавить
  `email-worker` строку `<<: *runtime-environment` (как у backend), он получит `STORAGE_SECRET_KEY`,
  `REDIS_URL` и т.д., а `pnpm deploy:check` пройдёт: проверка топологии смотрит только сети и порты.
  `emailWorkerEnvironmentSchema` и `notificationSignalEnvironmentSchema` не имеют ни одного unit-теста
  (`environment.spec.ts` проверяет только runtime и database), а `dist/email-worker.js` в CI не запускается
  ни разу, в отличие от `dist/deadline-worker.js` (`pnpm test:worker`). Ошибка загрузки воркера
  обнаружится только как unhealthy-контейнер на UAT.
- Fix: (1) в `check-compose.sh` проверить
  `Object.keys(config.services["email-worker"].environment).sort()` против 7 имён; (2) в
  `environment.spec.ts` два кейса для `loadEmailWorkerEnvironment`-схемы (минимальный набор принят,
  `live` в local отклонён) и один для signal-схемы; (3) после #8 (общий polling-воркер) достаточно в
  `deadline-worker-smoke.mjs` один раз стартовать и остановить по SIGTERM `dist/email-worker.js` в
  `disabled`-режиме.
- Losing functionality: нет, только проверки.

### D9. Документы описывают старое состояние транспорта уведомлений и CI (`_docs/environment.md:142-146,162,170,235-236,243-244`, `ROADMAP.md:538,1703`, `Dockerfile:72`)

- Case: читатель `environment.md` узнаёт, что PR запускает только `smoke`, хотя `ci.yml:211` для PR
  запускает `["smoke","visual"]` (и AGENTS.md говорит именно так); что `worker` — это «independent deadline
  entrypoint», и что `compose.deploy.yaml` состоит из «release, backend, worker, frontend and Redis», хотя
  там есть `email-worker` на том же образе; что «notification transport and inbox delivery are not
  implemented» и «There is no … notification transport» — оба реализованы в #197/#198. ROADMAP:538 —
  «Resend: … notifications planned», ROADMAP:1703 — «inbox/SSE and email delivery remain open», хотя
  Phase 17 тут же пишет, что они реализованы. Docker-образ, на котором работает email-воркер, подписан
  «PickFlick deadline worker».
- Fix: исправить эти строки (PR: smoke+visual по затронутым областям; образ `worker` содержит оба
  воркера; убрать два абзаца про «not implemented»; ROADMAP — «Contact and notification delivery built;
  live sandbox acceptance pending»); label → `PickFlick workers`.
- Losing functionality: нет, только тексты.

### D10. `packages/config/scripts/validate.mjs` не проверяет ничего, что не проверяет `tsc` (`packages/config/scripts/validate.mjs:1-11`, `packages/config/package.json:17-18`)

- Case: скрипт делает `JSON.parse` четырёх tsconfig-пресетов. `base.json` и `library.json` и так читает
  `tsc -p tsconfig.json` этого пакета, `node.json` — typecheck backend, `nextjs.json` — typecheck frontend;
  битый JSON в любом из них уже валит `pnpm typecheck`. Зато скрипт сломается на корректном tsconfig с
  комментарием (tsc комментарии допускает).
- Fix: удалить скрипт и `&& node scripts/validate.mjs` из `build`/`typecheck`.
- Losing functionality: нет; те же файлы валидирует `tsc` в том же прогоне.

## Nice to have

### D11. Тест каталога лежит в `describe('parseDatabaseEnvironment')` (`packages/config/src/__tests__/environment.spec.ts:269-288`)

- Case: «should validate source-specific credentials and shared catalog policy» вызывает
  `parseRuntimeEnvironment`, но стоит в блоке database-схемы — при поиске тестов каталога его не найти.
- Fix: перенести в `describe('parseRuntimeEnvironment')` рядом с тестами TMDB (строки 146–181).
- Losing functionality: нет.

### D12. extends #62: `hello@pick-flick.app` захардкожен ещё в 4 местах (`email/email-dispatcher.ts:133`, `email/email-alert.ts:28`, `email/email-template.ts:48,69`)

- Case: при смене support-адреса (ADR-009 разрешает только владельцу) нужно найти 6 мест в
  `email-environment.ts` и ещё 4 здесь; reply-to уведомлений и текст «Questions?» разъедутся.
- Fix: та же константа `SUPPORT_EMAIL`, что предлагается в #62 (экспорт из `@pickflick/config` или
  contracts), во всех четырёх местах.
- Losing functionality: нет.

### D13. Текст инбокса повторяет тему письма и лежит в файле политики (`notification-policy.ts:3-20`, `email/email-copy.ts:11-124`, `notification-resolver.ts:5`, `email/email-template.ts:30`)

- Case: для всех 16 событий `NOTIFICATION_MESSAGES[event]` равен `EMAIL_COPY[event].subject + '.'`, а
  «This update is no longer available.» записан дважды. Поправят тему письма — колокольчик продолжит
  показывать старый текст. Тексты лежат в `notification-policy.ts`, где новичок ищет правила каналов.
- Fix: `inbox` — поле в `EMAIL_COPY` (переименовать в `NOTIFICATION_COPY`) или
  `NOTIFICATION_MESSAGES` строить из `subject`; одна константа `UNAVAILABLE_COPY` для resolver и шаблона.
- Losing functionality: нет; тексты те же.

### D14. Ключи соответствий событий не типизированы (`notification-producers.ts:6`, `:89`)

- Case: `AUDIT_EVENTS: Partial<Record<string, …>>` — опечатка `MEMBERSHIP_REMOVE` в ключе компилируется,
  и уведомление молча не создаётся. `getSessionNotificationEvent(phase: string)` — то же для фаз, причём
  второе соответствие написано `switch`, а первое — объектом.
- Fix: типизировать ключи Prisma-enum'ами (`Partial<Record<ClubAuditAction, …>>`,
  `Partial<Record<SessionPhase, …>>`) и записать оба соответствия одинаково — объектом.
- Losing functionality: нет.

### D15. Мёртвое поле `resend.deliveryMode` (`packages/config/src/environment.schema.ts:223`)

- Case: `git grep deliveryMode` — поле нигде не читается; код использует только `deliveryEnabled`.
  Читатель гадает, где различаются `preview` и `disabled` в рантайме (нигде: оба просто «не live»).
- Fix: удалить строку.
- Losing functionality: нет; матрица валидации режимов (решение «env не трогаем») не меняется.

### D16. Схема Redis/сигналов вынесена в отдельный файл и дублирует список окружений (`packages/config/src/notification-environment.schema.ts:13`, `environment.ts:89`)

- Case: `z.enum(['local','test','uat','production'])` копирует `APP_ENVIRONMENTS`; добавят окружение —
  воркер дедлайнов откажется стартовать. Database- и email-worker-схемы лежат в `environment.schema.ts`,
  а signal-схема — отдельно, при этом `environment.schema.ts` импортирует из неё `redisUrl`.
  `loadNotificationSignalEnvironment` — единственный loader без явного типа возврата.
- Fix: перенести `redisUrl` и `notificationSignalEnvironmentSchema` в `environment.schema.ts`,
  использовать `z.enum(APP_ENVIRONMENTS)`, экспортировать `TNotificationSignalEnvironment`; файл удалить.
- Losing functionality: нет.

### D17. extends #70: воркер отправляет одно письмо за цикл в 5 секунд без пометки `shortcut:` (`email/email-dispatcher.ts:41-46`, `deadline-worker-loop.ts:5`)

- Case: архивирование Club на 16 участников с включённым email даёт 16 писем ≈ 80 с; очередь из 100
  отложенных писем — больше 8 минут. Для текущей нагрузки нормально, но лимит нигде не записан, и
  следующий читатель может принять это за баг.
- Fix: комментарий `// shortcut: one claim per 5 s cycle (~12 emails/min); revisit before Clubs or opt-in rates grow.`
- Losing functionality: нет.

### D18. В preview у `email-worker` нет healthcheck (`compose.preview.yaml:176-193`)

- Case: в `compose.deploy.yaml:162-173` у email-воркера есть проверка heartbeat, у deadline-воркера в
  preview — тоже (`compose.preview.yaml:160-171`), а email-воркер preview зависшим не помечается, хотя
  preview должен повторять deploy.
- Fix: скопировать тот же healthcheck.
- Losing functionality: нет.

### D19. Опечатки в названиях тестов (`scripts/__tests__/deploy-compose.spec.ts:72,87`)

- Case: «should does not start Compose…», «should refuses source-built production deployment».
- Fix: «should not start…», «should refuse…».
- Losing functionality: нет.

## Checked and fine

- `NotificationTransactions.run` публикует сигнал только после commit; откат — без публикации (тест есть).
  Redis-сообщения содержат только UUID получателя, канал разделён по `APP_ENV` (ADR-019).
- SSE: перед каждым сигналом и heartbeat заново проверяется сессия, при отзыве поток закрывается; тест есть.
  Нагрузка (запрос на 30 с на вкладку) терпима для ожидаемого числа пользователей.
- Inbox: список, курсор, mark-read ограничены получателем и `inApp`; курсор чужой записи — 404; пагинация
  при одинаковом `createdAt` стабильна (тест есть). N+1 уже в #4.
- Email: claim через `FOR UPDATE SKIP LOCKED`, lease 2 мин, fencing-токен, 6 попыток с задержками
  1/5/30/120/360 мин внутри 23 ч — совпадает с ADR-020 и `email-delivery.md`; `deliver` корректно
  останавливает повторы после окна; idempotency-ключ стабилен.
- Webhook: подпись по raw body (`rawBody: true` в `main.ts`), receipt-ID против повторов, корреляция по
  `providerId` или подписанному тегу + хэшу адреса, порядок статусов (DELIVERED не откатывается, bounce
  блокирует и обязательные письма), `svix-signature` редактируется в HTTP-логах, логи содержат только
  `notificationId` и тип события.
- Логи воркеров и dispatcher: только ID, номера попыток, фиксированные коды; ошибки env — имена
  переменных без значений (`EnvironmentValidationError`). Секретов/PII в логах не нашёл.
- Политика уведомлений: опциональные — in-app on / email off по умолчанию, выбор канала фиксируется при
  создании, `BILLING_SERVICE` обязателен на обоих каналах (плюс CHECK в БД) — соответствует ROADMAP.
- Production: `promote-production.yml` деплоит только при `vars.PRODUCTION_DEPLOY_ENABLED == 'true'`,
  проверка повторяется после approval, требуется успешный «UAT E2E» для того же SHA;
  `deploy-compose.mjs` отказывается от `APP_ENV != uat`; `run-release.mjs` — только uat/production.
- Delivery gate требует все 6 job'ов; UI-матрица для PR — `smoke`+`visual` по затронутым областям,
  общие файлы (`apps/frontend/**` вне областей, contracts, lockfile, `ci.yml`, сам скрипт) — полный
  набор; main/manual — `contract`+`visual`. Совпадает с AGENTS.md (расходится только `environment.md`, D9).
- Каждая runtime-переменная схемы есть в `.env.example` и `_docs/environment.md`; переменные тестовых
  утилит (`E2E_*`, `PLAYWRIGHT_BASE_URL`, `PICKFLICK_ENV_FILE`) — инструментальные, не runtime.
- Compose deploy: Redis только во внутренней сети `notification-signals`, без портов и персистентности;
  в неё входят только backend и worker (проверяется `check-compose.sh`); контейнеры read-only, `cap_drop: ALL`.
- `Dockerfile`: пины образов по digest, `.git` удаляется после записи ревизии, рантайм под `node`.
- `write-image-revision.mjs`/`build-images.mjs`: отказ от грязного дерева, проверка SHA, тесты есть.
- Тесты dispatcher/webhook покрывают конкурентный claim, брошенный lease, окно ретраев, постоянные
  отказы, suppression, гонку callback/ответа и отсутствие PII в логах.

Отброшено как мелочь (не включено): 2 пункта (двухшаговый разбор webhook-конверта; две query в
`InboxService.markRead`).
