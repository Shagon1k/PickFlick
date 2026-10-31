# Area: B — Backend Clubs, Auth и платформа

Read: `apps/backend/src/modules/clubs/**` (access, invitations, statistics, hub, lifecycle, avatar,
mapper, service, controller, module и все `__tests__`), `apps/backend/src/modules/auth/**` (включая
`__tests__`), `apps/backend/src/common/**`, `apps/backend/src/config/**`, `apps/backend/src/database/**`,
`apps/backend/src/modules/{health,contact,storage,email}/**` (с тестами), `apps/backend/src/main.ts`,
`apps/backend/src/app.module.ts`. Для сверки: `_docs/security.md`, `_docs/authentication.md`,
ROADMAP §3, `apps/backend/AGENTS.md`, `packages/contracts/src/clubs/club.schema.ts`, схема `Membership`
и `ClubAuditEvent`, `notification-producers.ts`, `notification-transactions.ts`, `session-completion.ts`,
`nomination-completion.ts`, `session-roster-projection.ts`, `email-dispatcher.ts` (только места вызова),
фронтенд `InvitationCard.tsx`, `ClubMembers.tsx`, `next.config.ts` (rewrites).
Not read: построчно `club-hub.int.spec.ts` (строки 60–328) и `club-invitations.int.spec.ts`
(строки 80–438), `club-ratings.int.spec.ts`, `club-pending-invitations.int.spec.ts` — просмотрены по
списку `describe/it` и фикстурам; `email/__tests__/resend-email.client.spec.ts` — не открывал.

Must fix: не найдено. Код Clubs/Auth в целом корректен: 404 для чужих Club, блокировки Club-строки,
идемпотентные повторы, аудит на каждое изменение. Ниже — расхождения правил, гонка с аватаром,
пропущенные тесты и читаемость.

## Must fix

—

## Should fix

### B1. Аватар меняется без блокировки Club-строки (`apps/backend/src/modules/clubs/club-avatar.service.ts:84-104`)

- Case: все остальные записи Club (settings, роли, lifecycle, invitations, delete) сначала берут
  `lockClub`, комментарий в `club-access.ts:71` это и обещает. `setAvatarKey` лок не берёт. (а) Admin
  удаляет Club, параллельно идёт `PUT /avatar`: `findMembership` читает Club ещё живым, `update` ждёт
  row-lock `delete` и после его commit записывает `avatarObjectKey` в удалённый Club. Объект в S3
  остаётся навсегда, потому что cleanup в `delete` уже прошёл. (б) Параллельно идёт archive: аватар
  меняется у Club, который уже ARCHIVED. (в) Два одновременных upload: оба читают previous = A,
  второй ставит C и снова удаляет A. Объект B осиротел.
- Fix: первой строкой транзакции в `setAvatarKey` добавить `await lockClub(transaction, clubId);`.
  Транзакцию открывать так же, как в остальном сервисе: `notifications.run`, или нейтральный runner
  после #49.
- Losing functionality: нет. Меняется только порядок: avatar-запись ждёт другие записи того же Club.

### B2. Лимит Admin-Club считается по двум разным тарифам (`clubs.service.ts:84`, `club-lifecycle.service.ts:157-161`)

- Case: `create` всегда берёт `getTierEntitlements('FREE').adminClubLimit` (= 1). `reactivate` берёт
  тариф **реактивируемого** Club: `getClubEntitlements(clubId).adminClubLimit`. Лимит Clubs на Admin —
  правило пользователя, а не Club. Пример: Admin ведёт активный FREE Club и архивный PRO demo-Club.
  Reactivate проходит (1 < 5), и у него 2 активных Club. `POST /clubs` в той же ситуации отвечает
  `ADMIN_CLUB_LIMIT_REACHED`. Кроме того, правило-функция `assertBelowAdminLimit` экспортируется из
  `clubs.service.ts:238-255`, и её импортирует другой сервис (`club-lifecycle.service.ts:19`). Новичок
  не ищет доменное правило в файле сервиса.
- Fix: перенести `assertBelowAdminLimit(tx, userId)` в `access/club-tiers.ts` (или в
  `club-access.ts`) вместе с `lockKey('club-admin:…')`. Лимит брать из одного места —
  `getTierEntitlements('FREE').adminClubLimit`. Добавить `shortcut:`: «пока billing (Phase 20) не даёт
  тариф пользователя». Оба вызова — `await assertBelowAdminLimit(tx, userId)`.
- Losing functionality: нет. Единственное отличие — seeded PRO demo-Club больше не обходит
  FREE-лимит при реактивации. Это и есть правило создания.

### B3. Флаг `createInvitations` не совпадает с сервером при заполненном Club (`access/club-permissions.ts:24`, `invitations/club-invitations.service.ts:69`)

- Case: комментарий в `club-permissions.ts:8-11` обещает, что «services enforce the same flags». У Free
  Club с 8/8 участниками `access.newWorkAllowed = true`, потому что MEMBER_LIMIT срабатывает только при
  `>`, и `createInvitations: true`. При этом `create` всегда отвечает `409 MEMBER_LIMIT_REACHED`
  (`>=`). Фронтенд поэтому выводит правило сам: `InvitationCard.tsx:29`
  `members.length >= entitlements.memberLimit`, а лимит ссылок — в `:30`. `ClubMembers.tsx:60`
  показывает «+ Invite» в заполненном Club. Одно правило записано в двух местах и в двух слоях.
- Fix: в `getClubPermissions` для `createInvitations` учитывать заполненность. Передать
  `memberCount`/`memberLimit` (они уже есть в `loadClubAccess` и `getSettings`) или добавить
  `isAtCapacity` в `IClubAccess`. На фронте убрать `isMemberLimitReached` и опираться на флаг. Текст
  «member limit is reached» показывать по `access`.
- Losing functionality: нет. Сервер отказывает так же, UI показывает ту же подсказку из одного
  источника.

### B4. Правило «можно присоединиться к Session» скопировано (`clubs/club-hub.ts:127-130`, `sessions/roster/session-roster-projection.ts:35-42`)

- Case: оба места заново собирают `isOpen && club ACTIVE && !['ACCEPTED','REMOVED'].includes(ownStatus)`,
  и это же правило проверяется в `session-roster.service.ts:42-47`. Если поменять, например, разрешить
  повторный join после REMOVED или запретить join в adminless Club, то Hub и Session detail начнут
  показывать разные кнопки.
- Fix: одна функция `canJoinSession({ phase, lifecycle, ownStatus })` в `sessions/session-access.ts`.
  Её вызывают hub, roster-projection, и её же использует join-сервис.
- Losing functionality: нет.

### B5. `getClubPermissions` по умолчанию «открыт», если не передан `access` (`access/club-permissions.ts:15,23-24`)

- Case: параметр `access?` и `(access?.newWorkAllowed ?? true)`. Все продакшн-вызовы (`club-hub.ts:146`,
  `clubs.service.ts:145`, `sessions/session-access.ts:14`) передают `access`. Опциональным он остаётся
  только ради `club-permissions.spec.ts`. Новый вызов без `access` в adminless или over-limit Club
  молча получит `manageSessions: true` и `createInvitations: true`. Это fail-open в правиле
  авторизации, и `session-access.ts` прямо говорит, что от этого флага зависит сервер.
- Fix: сделать `access: IClubAccess` обязательным, убрать `?? true`. В `club-permissions.spec.ts`
  передавать `getClubAccess(...)`. Заодно см. B13.
- Losing functionality: нет. Все реальные вызовы уже передают `access`.

### B6. Startup теряет причину падения (`apps/backend/src/main.ts:40-49`)

- Case: Nest с `abortOnError` сам логирует ошибки инициализации модулей. Поэтому в `catch` попадают
  ошибки `loadRuntimeEnvironment`, `configureApplication` и `app.listen`. Для всего, что не env,
  пишется только `{"event":"service.start.failed"}` без сообщения. Пример: порт занят (`EADDRINUSE`)
  или неверный `backendHost` — в логе UAT нет ни слова о причине. AGENTS.md: «Never swallow errors».
  Рядом `unhandledRejection` (`main.ts:21-26`) пишет stack — правило непоследовательно.
- Fix: в ветке без `failures` добавить
  `{ error: error instanceof Error ? (error.stack ?? error.message) : String(error) }`, как в
  `unhandledRejection`. Env-ветку не трогать: она по-прежнему пишет только имена переменных.
- Losing functionality: нет.

### B7. Нет тестов на два правила входа (`modules/auth/auth.config.ts:120-141`, `auth/__tests__/auth.int.spec.ts`)

- Case: `_docs/authentication.md` требует: «A new User is created only when the provider says the email
  is verified» и «provider tokens are cleared before the account row is written». Оба правила — хуки
  `databaseHooks.user.create.before` и `account.create/update.before`. Ни один тест не упадёт, если
  хук удалить или Better Auth переименует поле (`accessToken` → `access_token`). `auth.int.spec.ts`
  покрывает return target, suspended, forged cookie, sign-out, 404, но не эти два.
- Fix: два integration-теста через уже поднятый контекст
  (`(await service.auth.$context).internalAdapter`): `createUser({ emailVerified: false, … })`
  отклоняется с `EMAIL_NOT_VERIFIED`, а `createAccount({ accessToken: 'x', refreshToken: 'y', … })`
  сохраняет строку `providerAccount` с `null` в токенах.
- Losing functionality: нет, только тесты.

## Nice to have

### B8. Средняя оценка в «recent» зависит от того, попала ли Session в history (`clubs/club-hub.ts:102-108`)

- Case: `visibleRatingIds` строится только из `history` (top-20 COMPLETED+CANCELLED по `updatedAt`), а
  `project` применяется и к `recent`. Если после завершённой Session X отменили 16+ Session, X остаётся
  в `recent` (там нет CANCELLED), но выпадает из `history`. Карточка в recent показывает
  `ratingAverage: null`, хотя оценки видны.
- Fix: фильтровать `rows` вместо `history` (`rows.filter(...)`). Код не растёт.
- Losing functionality: нет.

### B9. Archive «завершает» Sessions — без why-комментария (`clubs/club-lifecycle.service.ts:164-172`)

- Case: при archive цикл вызывает `completeSessionPhase` для каждой открытой Session. Читатель решит,
  что архивирование закрывает фазы. На деле все ветки completion требуют
  `club.lifecycle === 'ACTIVE'` (`nomination-completion.ts:30` и т. д.). При archive вызов только
  публикует `PROGRESS`, чтобы открытые страницы обновились. При reactivate он досчитывает N/N,
  накопленные за время архива.
- Fix: одна строка комментария-«почему» над циклом: «Archive only bumps progress so open pages refresh;
  reactivation re-evaluates N/N that changed while archived».
- Losing functionality: нет.

### B10. Устаревшие и неточные комментарии (`clubs/club-lifecycle.service.ts:27`, `common/pipes/zod-validation.pipe.ts:4`)

- Case: «Each action is naturally idempotent» — повтор `leave`/`delete` отвечает 404 (Club уже не
  виден), а не 204. Данные идемпотентны, ответ — нет: тот, кто повторяет запрос, ждёт 204.
  `ZodValidationPipe` описан как «Parses a request body», но используется и для `@Query`
  (`club-ratings.controller.ts:18`).
- Fix: «Repeating an action changes nothing; leave and delete then answer 404 because the Club is gone
  for the caller»; «Parses a request body or query with a contracts schema».
- Losing functionality: нет.

### B11. `isAvatarMediaType` проверяет через `in` (`clubs/club-avatar.service.ts:23-25`)

- Case: `'constructor' in EXTENSIONS === true`. С `Content-Type: constructor` охрана типа проходит.
  Запрос отсекает только следующая проверка сигнатуры, то есть guard врёт про тип.
- Fix: `CLUB_AVATAR_MEDIA_TYPES.includes(value as TClubAvatarMediaType)` — константа уже
  импортируется в contracts — или `Object.hasOwn(EXTENSIONS, value)`.
- Losing functionality: нет.

### B12. `IEmailClient.send(): Promise<string | void>` (`modules/email/email.types.ts:14`, `notifications/email/email-dispatcher.ts:58-61`)

- Case: `void` нужен только ради `LoggingEmailClient`. Dispatcher всегда создаётся с
  `ResendEmailClient` (`email-worker.ts:32`), который возвращает `string` или бросает. Поэтому
  `let providerId: string | void` и ветка `missing_provider_id` в продакшне недостижимы.
- Fix: `send(): Promise<string>`. `LoggingEmailClient` возвращает синтетический id
  (`logged-${randomUUID()}`), ветку `missing_provider_id` и `| void` удалить.
- Losing functionality: нет.

### B13. Позиционный boolean в `getClubAccess` (`clubs/access/club-access.ts:79-90`, вызовы `:106`, `clubs.service.ts:135-140`)

- Case: `getClubAccess(club.lifecycle, Boolean(admin), memberCount, memberLimit)` и
  `getClubAccess(club.lifecycle, members.some(...), members.length, …)`. Без сигнатуры непонятно, что
  второй аргумент — «есть Admin». Это нарушает правило «no boolean positional arguments».
- Fix: объект `getClubAccess({ lifecycle, hasAdmin, memberCount, memberLimit })`.
- Losing functionality: нет.

### B14. Имена: константы и расплывчатые переменные (extends #47)

- Case: module-level константы не в UPPER_SNAKE: `clubColumns` (`access/club-access.ts:8`),
  `sessionInclude` (`club-hub.ts:17`), `noProviderTokens` (`auth/auth.config.ts:166`), `errors`
  (`common/filters/api-exception.filter.ts:13`), `responseSchema`/`errorSchema`
  (`email/resend-email.client.ts:7-8`). Расплывчатые имена: `rows` (`club-hub.ts:85` — это Sessions
  hub), `own` (`club-hub.ts:97` — собственные participant-строки), `found`
  (`invitations/club-invitations.service.ts:229`), `snapshot` (`clubs.service.ts:53`),
  `selected` (`clubs.service.ts:68` — это Movie активной Session).
- Fix: `CLUB_COLUMNS`, `HUB_SESSION_INCLUDE`, `NO_PROVIDER_TOKENS`, `ERRORS_BY_STATUS`,
  `RESEND_RESPONSE_SCHEMA`/`RESEND_ERROR_SCHEMA`; `hubSessions`, `ownParticipants`, `inviteClub`,
  `hubWithoutStatistics`, `activeMovie`.
- Losing functionality: нет.

### B15. `selectionScaleMin === 1 ? 1 : 0` в маппере (extends #11/#74) (`clubs/club.mapper.ts:38`)

- Case: та же конструкция, что в #11, только в Club-маппере. Скрывает, что поле — просто
  `club.selectionScaleMin`. Нечаянное значение 2 молча превратится в 0.
- Fix: после #74 (`z.int().min(0).max(1)`) — `selectionScaleMin: club.selectionScaleMin`.
- Losing functionality: нет.

### B16. Колонка `ClubAuditEvent.changed` всегда `true` (`clubs/access/club-access.ts:57-67`)

- Case: `recordAudit` единственный пишет аудит и всегда ставит `changed: true`. В коде колонку никто не
  читает. Её помнят только CHECK-ограничения старых миграций (`20260918000100…`, `20260918000300…`),
  где ветка `NOT "changed"` с тех пор недостижима. Новичок видит `Omit<…, 'changed'>` и ищет, где
  бывает `false`.
- Fix: новая миграция (историю не править). Переписать CHECK-и на ветку `changed`, удалить колонку,
  из `recordAudit` и `TAuditEvent` убрать `changed`.
- Losing functionality: нет. Значение никогда не бывает `false` и нигде не читается.

## Checked and fine

- 404 для чужого и удалённого Club: `findMembership` фильтрует `status ACTIVE` и `club.deletedAt null`.
  App Admin прав в Club не получает. 403 только внутри видимого Club.
- Порядок блокировок: `lockKey(club-admin)` → `lockClub` → `lockSession` одинаков в create, reactivate,
  leave/remove (через `departSessions`), invitations accept/revoke/create.
- Invitations: в БД только SHA-256 digest; токен на 32 байта; 12 ч для Club и 7 дней по умолчанию
  только для legacy Session (`createInviteToken` без аргумента всё ещё вызывается из
  `session-roster.service.ts:108`). Мест проверяются при accept под lockClub. Лимит живых ссылок =
  memberLimit. Закрытые состояния не раскрывают Club. Повторный вход бывшего участника создаёт новую
  Membership (partial unique index на ACTIVE). N+1 в `listPending` терпим при ожидаемой нагрузке.
- Typed confirmation (`ARCHIVE`/`LEAVE`/`REMOVE`/имя Club) сверяется на сервере. Admin не может уйти
  (`ADMIN_MUST_TRANSFER`). Delete только без Sessions, soft delete с аудитом и cleanup аватара после
  commit.
- Removal и role-change в adminless/over-limit Club разрешены (решение «one manager rule»), в archived
  запрещены, leave разрешён. Всё покрыто `club-membership.int.spec.ts`.
- Auth: глобальный guard, `@Public` только у health/contact. Наружу отдаётся allowlist Better Auth
  routes. При suspend все сессии удаляются. Return target по allowlist, `errorCallbackURL` и
  `newUserCallbackURL` перезаписываются. `__Host-` cookie, `SameSite=Lax`. Account linking выключен.
  Логгер провайдера без аргументов.
- `ApiExceptionFilter`: наружу уходят только код и `reason` формата `^[A-Z_]+$`, 5xx пишется в лог.
  Security-заголовки API и `x-powered-by` проверены тестом. Лимит body 100 KB. Avatar сверяет
  сигнатуру байтов.
- Redaction логов: `req.url`, referer, location, cookie, authorization, svix-signature, set-cookie.
  Request ID принимается только как UUID.
- Health: `@Public` + `@SkipThrottle`, таймаут 2 с на probe. Storage `get` → `null` только на
  `NoSuchKey`, остальные ошибки пробрасываются.
- Club analytics: FREE не читает metadata. Фильтр `showRatingResults` для MEMBER применяется до
  усреднения. Пагинация лидерборда клампится. Watch time `null` при пропусках.
- Уже покрыто прежними пунктами и не повторяю: Cache-Control на каждом handler (#50),
  `uuidParam`/`uuid` ParseUUIDPipe (#51), `NotificationTransactions.run` в читающих методах
  `getHub`/`getSettings`/`preview`/`listPending` (#49), дубль запроса участников в
  `getSettings`/`readClubHub` (#52), длина `readClubHub` (#32), `getMostFrequent` (#14), poster URL
  (#65), `snapshot === null` как FREE в `club-ratings.service.ts` (#47).

Отброшено как слишком мелкое: 3 — двойная проверка роли и lifecycle в `removeMember` перед
`canRemoveMember`, тип `TImageType`, дублирующий `TClubAvatarMediaType`, `encryptOAuthTokens` при
обнулённых токенах.
