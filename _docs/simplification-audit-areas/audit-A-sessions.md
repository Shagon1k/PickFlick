# Area: A — Backend Sessions

Read: every file in `apps/backend/src/modules/sessions/**`: root (`sessions.module/controller/service`,
`session-access`, `session-lock`, `session-progress`, `session-completion`), `roster/`, `nominations/`,
`selection/`, `rating/`, `watching/`, `past/`, все `__tests__` (production — построчно, int-спеки —
заголовки всех кейсов и построчно `sessions.int.spec.ts`, ключевые места `nomination-deadlines.int.spec.ts`);
`apps/backend/src/deadline-worker.ts`, `deadline-worker-loop.ts`. Для сверки: ROADMAP §3 и §5, ADR-018,
ARCHITECTURE (roster, deadlines, progress, selection ballots, notification intent), `schema.prisma`
(Session-модели), миграция `20261014010000_selection_ballots`, `notification-producers.ts`,
`club-access.ts`, контракты `sessions/*.schema.ts`, использование API во фронтенде (`git grep`).
Not read: `__tests__/deadline-worker-loop.spec.ts` и `scripts/deadline-worker-smoke.mjs` (только найдены —
относятся к #8/#33); внутренности notifications/clubs — зона других аудиторов.

Ни одного подтверждённого бага уровня «Must fix» не нашёл: блокировки Club → Session, `phaseVersion`,
идемпотентность close/open/cancel и правила N/N совпадают с ROADMAP. Ниже — то, что мешает надёжности и
пониманию.

## Must fix

— нет.

## Should fix

### A1. `SessionProgressEvent` и `NominationDeadlineNotification` пишутся, но никем не читаются; `publishProgress` делает три работы (`apps/backend/src/modules/sessions/session-progress.ts:8-38`, `nominations/nomination-deadlines.ts:118-143`)

- Case: каждый номинейшн, ballot, рейтинг, изменение ростера или деталей → `publishProgress` делает
  `UPDATE progressVersion` + `SELECT` всех accepted-участников + `INSERT SessionProgressEvent`. `git grep`
  показывает: строки `SessionProgressEvent` читают только тесты. ARCHITECTURE прямо пишет «Nothing reads
  these rows yet: the outbox is kept by owner decision (#172) as the source for the notification phase».
  Phase 17 построила уведомления **без** этой таблицы (`recordSessionNotifications`), так что причина
  исключения исчезла. Аналогично `NominationDeadlineNotification` (`notifications: { create: recipients }`,
  строки 118-141) дублирует настоящие `Notification` (`recordSessionNotifications(..., 'NOMINATION_STALLED')`,
  строка 145): отдельный запрос получателей ради таблицы, которую никто не читает. Таблица растёт без
  ограничения. Вдобавок `publishProgress` решает «слать ли уведомления» по строке `kind`
  (`kind !== 'PROGRESS' && kind !== 'DETAILS'`): читатель `publishProgress(tx, id, 'MANUAL')` не видит,
  что это отправка уведомлений; путь EMPTY-дедлайна уведомляет напрямую — два способа одного действия.
- Fix (нужно решение владельца, т.к. отменяет решение #172): перестать писать обе таблицы (новая
  миграция `DROP TABLE` или просто прекратить запись; историю миграций не трогать). `publishProgress`
  становится `bumpProgressVersion(tx, id)`; переходы (`advanceNomination/Selection/Rating`, `openRating`,
  `cancel`) явно вызывают `recordSessionNotifications(tx, session, getSessionNotificationEvent(phase))`.
  Тип `kind` и запрос участников уходят. `NominationDeadlineDecision` (аудит автоматического решения и
  маркер «этот deadlineVersion обработан») остаётся. Обновить ARCHITECTURE/ADR-018 запись.
- Losing functionality: нет — клиенты опрашивают только `progressVersion`, уведомления создаёт
  `Notification`; аудит дедлайна остаётся в `NominationDeadlineDecision`.

### A2. Уведомления о переходах фаз почти не покрыты тестами (`session-progress.ts:34-37`, `nominations/__tests__/nomination-deadlines.int.spec.ts:112-158`)

- Case: если в `nominations.service.ts:135` или `selection-completion.ts:65` передать `'PROGRESS'` вместо
  `'MANUAL'`/`'AUTOMATIC'`, участники перестанут получать «Selection opened» / «A Movie is ready to watch»,
  и ни один тест не упадёт. По `git grep` в спеках проверяются только `SESSION_STARTED` и `RATING_OPENED`;
  `SELECTION_OPENED`, `SELECTION_CLOSED`, `RATING_CLOSED`, `SESSION_CANCELLED`, `NOMINATION_STALLED` — нет.
  Тесты дедлайна с названием «notify … atomically» проверяют только legacy-строки
  `NominationDeadlineNotification` (A1), а не то, что видит пользователь.
- Fix: в существующие кейсы (`nominations.int` close, `selection-completion.int` auto/manual,
  `rating.int` auto/manual, `sessions.int` cancel, `nomination-deadlines.int` EMPTY/WATCHING) добавить по
  одному `expect(await api.prisma.notification.findMany({ where: { sessionId } }))` на событие и аудиторию
  (участники vs Admin/Moderators). Делать вместе с A1 — тогда тесты защищают новую явную отправку.
- Losing functionality: нет, только тесты.

### A3. `advanceNomination` не публикует прогресс, а `advanceSelection`/`advanceRating` публикуют (`nominations/nomination-completion.ts:6-22`)

- Case: `selection.service.close` вызывает только `advanceSelection` (публикация внутри,
  `selection-completion.ts:65`), `rating.service.close` — только `advanceRating` (`rating-completion.ts:19`),
  а `nominations.service.close` (`nominations.service.ts:134-135`) и дедлайн (`nomination-deadlines.ts:148-149`)
  обязаны вызвать `publishProgress` сами. Разработчик, скопировавший шаблон Selection в новый путь закрытия
  Nomination, получит переход без `progressVersion` (клиенты не обновятся) и без уведомлений. Одно правило
  применено двумя способами.
- Fix: `advanceNomination(tx, session, nominations, kind)` сам вызывает `publishProgress(tx, session.id, kind)`;
  убрать два внешних вызова и параметр `hasAdvanced`-ветку в `completeNomination` сделать как в
  `completeSelection` (`advance…; return;` иначе `publishProgress('PROGRESS')`).
- Losing functionality: нет — тот же один progress-event на переход.

### A4. Правило «Selection фиксирует номинации при открытии» живёт только в триггере миграции (`nominations/nomination-completion.ts:11-21`, `packages/database/prisma/migrations/20261014010000_selection_ballots/migration.sql:9-24`)

- Case: `advanceNomination` ставит `phase: 'SELECTION'`, а `selection.service`/`selection-completion`
  читают `isInSelection: true`. Где это поле становится `true`, из TypeScript не найти: его ставит
  PostgreSQL-триггер `Session_snapshot_selection_nominations`, добавленный «на время rollout». Новичок,
  меняющий переход (например, переводящий Nomination → Selection через raw SQL или меняющий статус
  участника до апдейта фазы), не знает, что порядок записей влияет на набор фильмов в Selection.
- Fix (минимальный): комментарий «почему» в `advanceNomination`: «Trigger
  `Session_snapshot_selection_nominations` freezes accepted participants' nominations (`isInSelection`)
  when phase becomes SELECTION; update participant status before this write». Альтернатива с удалением
  кода: явный `tx.nomination.updateMany({ where: { sessionId, participant: { status: 'ACCEPTED' } }, data:
{ isInSelection: true } })` в `advanceNomination` и новая миграция `DROP TRIGGER` — решать владельцу.
- Losing functionality: нет — набор фильмов фиксируется тем же правилом.

### A5. Мёртвая поверхность roster API: создание персональных токенов, ответ по ID, `eligibleMembers`, `canInvite` (`roster/session-roster.controller.ts:51-59`, `:123-132`, `roster/session-roster-projection.ts:33`, `:74-92`)

- Case: фронтенд (`apps/frontend/src/api/session-roster.server.ts`) не вызывает
  `POST /sessions/:id/invitations` и `POST /session-invitations/:inviteId/respond` — только int-спеки.
  Pending-тикеты теперь несут Session ID и идут в `/sessions/:id/participation`, так что invite ID у
  получателя нет нигде. ROADMAP говорит только о **существующих** персональных ссылках («Existing
  personalized token links keep their seven-day expiry»), их обслуживают preview/respond по токену и
  revoke. Для каждого менеджера чтение ростера делает лишний `membership.findMany` для `eligibleMembers`,
  который фронт не читает; `canInvite` всегда равен `canManage` и фронтом не используется (только в
  UI-моках).
- Fix (нужно решение владельца, т.к. описано в ARCHITECTURE): удалить два маршрута, `create`/`respond({ id })`
  ветку, `eligibleMembers` и `canInvite` из проекции и контракта; тесты, создающие токен через API,
  перевести на фикстуру `sessionInvite.create`. Оставить `preview`, `respond` по токену, `revoke`,
  `toInvitationPreview`.
- Losing functionality: существующие ссылки по-прежнему открываются, принимаются и отзываются;
  пропадает только невостребованная возможность выпускать новые персональные ссылки через API.

### A6. Ошибка дедлайна теряется полностью — нечего диагностировать (`nominations/nomination-deadlines.ts:68-76`, `deadline-worker-loop.ts:15-17`)

- Case: если решение одной Session падает (баг, нарушение constraint, `P2034` сериализации), воркер
  каждые 5 с пишет `{ event: 'deadline.failure', reason: 'TRANSACTION_FAILED' }` без класса и кода ошибки.
  Session стоит в Nomination бесконечно, а оператор UAT по логам не отличит таймаут БД от бага в коде.
  Цикловой `catch` в `deadline-worker-loop.ts` то же самое (`deadline.cycle.failed` без причины).
  AGENTS.md: «Never swallow errors … log and rethrow».
- Fix: логировать безопасные поля: `errorName: error instanceof Error ? error.name : 'unknown'` и
  `code` у `Prisma.PrismaClientKnownRequestError` (это коды вида `P2002`, без данных пользователя).
  Сообщение по-прежнему не логировать.
- Losing functionality: нет; логи остаются без PII.

### A7. Нормализация входа в `update` написана дважды (`sessions.service.ts:134-141`, `:267-276`)

- Case: `data` (строки 134-140) и `matchesDetails` (267-276) независимо переводят `input` в значения строки
  (`new Date(...)`, `?? null`). Если добавить поле в `data` и забыть `matchesDetails`, правка, меняющая только
  это поле, будет принята за повтор и молча вернёт 200 без записи. Две копии, которые обязаны меняться вместе.
- Fix: `matchesDetails(session, data)` сравнивает уже собранный `data` с `session` (getTime для дат);
  `hasDeadlineChanged` берётся из того же сравнения.
- Losing functionality: нет — то же идемпотентное поведение повторной правки.

### A8. Пять копий «аудит Session от имени актёра» при готовом `recordSessionAudit` (`sessions.service.ts:247-265`)

- Case: один и тот же блок `recordAudit(tx, { clubId, sessionId, actorUserId: userId, subjectUserId: userId,
subjectMembershipId: membership.id, action })` скопирован в `nominations.service.ts:126-133`,
  `selection.service.ts:135-142`, `rating.service.ts:115-122`, `watching.service.ts:30-37`,
  `past/past-sessions.service.ts:138-145`, а `sessions.service.ts` держит для этого приватный
  `recordSessionAudit` с суженным union `action`. Изменение правила субъекта придётся делать в 6 местах.
- Fix: перенести `recordSessionAudit` в `session-access.ts` (тип `action: TAuditEvent['action']`) и
  вызвать во всех шести местах.
- Losing functionality: нет — те же записи аудита.

## Nice to have

### A9. `completeSessionPhase` вызывает `completeNomination` для Watching/Completed/Cancelled (`session-completion.ts:8-19`)

- Case: изменение ростера в Watching идёт в `completeNomination`, который просто публикует `PROGRESS`.
  Читатель видит «завершить номинацию» для Session, где номинации давно закрыты; плюс каждая ветка заново
  читает ту же Session.
- Fix: `if (phase === 'NOMINATION') return completeNomination(...)`, а в конце — явный
  `publishProgress(tx, sessionId, 'PROGRESS')` для остальных фаз.
- Losing functionality: нет.

### A10. Одно правило lifecycle — три inline-копии и два разных reason (`nominations.service.ts:97-98`, `selection.service.ts:86-87`, `rating.service.ts:71-72`, `roster/session-roster.service.ts:42-43`)

- Case: в архивном Club отправка номинации/ballot/рейтинга отвечает `CLUB_ARCHIVED`, а присоединение —
  `CLUB_READ_ONLY` для того же условия `lifecycle !== 'ACTIVE'`. Session-actions фронтенда знают только
  `CLUB_READ_ONLY`, поэтому для `CLUB_ARCHIVED` показывается общий текст. В `club-access.ts:51` уже есть
  `assertActive(membership)`.
- Fix: вызывать `assertActive(membership)` в трёх submit; для `participate` выбрать тот же reason
  (или добавить `CLUB_ARCHIVED` в маппинг фронта).
- Losing functionality: нет.

### A11. `canManage` считается дважды за один `GET /sessions/:id` (`rating/rating.service.ts:54`)

- Case: `sessions.service.get` уже вычислил `canManageSession` (`sessions.service.ts:42`, 2 запроса в
  `loadClubAccess`) и передаёт его в `loadNominations` через `viewer.canManage`, а `loadRating` вызывает
  `canManage` заново — ещё 2 запроса и другой способ передачи того же факта.
- Fix: передать `canManage` в `loadRating` так же, как в `loadNominations`.
- Losing functionality: нет.

### A12. Extends #12 — ещё 6 написаний `Awaited<ReturnType<typeof findMembership>>`

- Case: `session-access.ts:11`, `:26`, `:35`; `nominations/nominations.service.ts:31`;
  `selection/selection.service.ts:24`, `:34` — при готовом `TMembership` (`club-access.ts:43`), который уже
  используют `selection-outcome.ts` и `past-selection-projection.ts`.
- Fix: `TMembership` везде.
- Losing functionality: нет.

### A13. Extends #11 и лишняя повторная проверка типа (`selection/selection.service.ts:59`, `past/past-selection-projection.ts:14`)

- Case: `scaleMin: session.selectionScaleMin === 0 ? 0 : 1` повторён в live-проекции Selection (та же
  проблема, что #11/#74). `loadPastSelection` снова проверяет `session.type !== 'PAST'`, хотя единственный
  вызывающий (`selection.service.ts:26-28`) уже ветвится по типу.
- Fix: вместе с #74 — `session.selectionScaleMin`; удалить проверку в `loadPastSelection`.
- Losing functionality: нет.

### A14. Мелкие формы в дедлайне и Selection (`nominations/nomination-deadlines.ts:115-117`, `selection/selection-completion.ts:57`)

- Case: `let outcome = 'EMPTY'; if (len === 1) outcome = …; if (len > 1) outcome = …` — результат зависит
  от порядка присваиваний; `inputs: { ...inputs }` копирует объект без причины.
- Fix: `const outcome = getDeadlineOutcome(nominations.length)` с ранними `return`; `inputs` без spread.
- Losing functionality: нет.

### A15. Extends #47 — расплывчатые имена в проекциях Nomination/Selection (`nominations/nominations.service.ts:45-74`, `selection/selection.service.ts:40-42`)

- Case: `own`, `rows`, `visible`, `ids` (`loadNominations`), `own`, `accepted` (`loadSelection`) —
  те же имена, что #47 нашёл в `rating.service`.
- Fix: `ownParticipant`, `nominationRows`, `visibleNominations`, `movieIds`, `acceptedParticipants`.
- Losing functionality: нет.

### A16. Одно понятие — два поля: `canEdit`/`canCancel` (`sessions.service.ts:241-242`)

- Case: оба поля всегда равны `canManageSession && isOpen`; фронт использует `canEdit` и для «закрыть
  Selection» и «открыть Rating», то есть это на деле «can manage Session».
- Fix: одно поле `canManage` в контракте (как в ростере), фронт читает его.
- Losing functionality: нет.

### A17. Extends #8 — фатальная ошибка воркера без причины (`apps/backend/src/deadline-worker.ts:70-74`)

- Case: недоступна БД при старте (`SELECT 1` падает) → лог `deadline.worker.failed` с `failures: undefined`,
  т.к. `getSafeEnvironmentValidationFailures` знает только ошибки env.
- Fix: при выносе общего bootstrap (#8/#33) добавить `errorName`/Prisma `code` как в A6.
- Losing functionality: нет.

## Checked and fine

- Один блокирующий Session на Club: проверка под `lockClub` + partial unique index с переводом `P2002`
  в `BLOCKING_SESSION`; Rating и Completed слот не занимают; `openRating` освобождает слот в той же транзакции.
- Порядок блокировок Club → Session во всех писателях: `lockSessionForMember`, `respond`, дедлайн
  (`execute`), `departSessions` (Club держит вызывающий, Sessions по `sessionId asc`).
- Автоматические переходы: N = accepted, «≥1 номинация и все N» (1 → Watching, ≥2 → Selection), дедлайн
  0/1/≥2, повторные фильмы считаются отдельно, архивный Club ставит на паузу; ручные close
  проверяют `phaseVersion` и идемпотентны; Watching → Rating только вручную.
- ADR-018: Session-строка — расписание, `deadlineVersion` растёт только при изменении дедлайна,
  `NominationDeadlineDecision` — маркер «обработано», повторная проверка всех условий под блокировками,
  несвязанные правки не сбрасывают EMPTY-алерт.
- Session-приглашения: `toInvitationPreview` не раскрывает ничего не-участнику (`unavailable`), принятие
  меняет только `SessionParticipant`, Membership не создаётся; REMOVED не может вернуться сам.
- Шкала Selection: ballot проверяется по снимку Session (`selectionScaleMin/Max`), полнота ballot,
  неизменяемость (unique + отсутствие update), tie-break по ROADMAP включая BigInt-ID и «нет маппинга — в конце».
- Видимость результатов: breakdown Selection — Admin/Moderator или Pro + снимок; Rating-результаты —
  после завершения, Admin/Moderator или снимок `showRatingResults`; свой ответ виден всегда.
- Session Rating и Personal Rating — разные сущности; идентичный повтор сохраняет ответ; после
  завершения новая отправка отклоняется.
- Past Sessions: валидация фильмов, номинаторов, участников, диапазона матрицы, дублей по userId; запись
  в одной транзакции под `lockClub` (повтор — см. #10).
- Тесты: конкуррентность (create, submit, close, deadline vs operator, roster vs submit), откат при сбое
  outbox/аудита, архив/adminless/over-limit — покрыты int-спеками.

Dropped smaller items: 3 (порядок вывода imported-номинаций по UUID, широкий `catch P2002` в `create`,
loose-типизация `IDeadlineEvent`).
