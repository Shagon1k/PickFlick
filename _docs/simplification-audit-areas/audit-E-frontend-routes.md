# Area: E — Frontend product routes, API layer, lib

Read: все файлы (prod и тесты) в `apps/frontend/src/app/(product)/**` (app, clubs/new, clubs/[clubId]/(hub)/_ включая settings и members, clubs/[clubId]/\_components/_, sessions/new, sessions/past/new, sessions/[sessionId]/_ и все `_-actions.ts`, library/*, movies/[movieId]/*), `apps/frontend/src/api/**`, `apps/frontend/src/lib/**`(включая`**tests**`). Для проверки контрактов дополнительно: `apps/frontend/src/proxy.ts`, `packages/contracts/src/auth/return-target.ts`, `clubs/club.schema.ts`, `movies/library.schema.ts`, `clubs/ratings.schema.ts`, backend `club-permissions.ts`, `club-invitations.service.ts`, `club-ratings.ts`, `library.service.ts`(пагинация),`components/clubs/club-form.validation.ts`, `ProductFrame.tsx`.
Not read: SCSS прочитан выборочно (поиск межроутовых импортов, размеры кнопок `.textButton`, `.remove`, `.refresh`— все 44px через`var(--hit)`); общие компоненты `components/sessions/_`, `components/movies/_`, `components/shells/\*`— зона другого аудитора, смотрел только их вызовы. Маршрута`/search`в`(product)`нет — поиск живёт в`components/sessions/MoviePicker` (зона компонентов).

## Must fix

### E1. Частичный сбой вкладки Hub рисует второй ProductFrame внутри первого и прячет вкладки Club (`apps/frontend/src/app/(product)/clubs/[clubId]/_components/ClubHubFrame/ClubHubFrame.tsx:26`, `.../(hub)/achievements/page.tsx:36`)

- Case: Hub загрузился в layout (`getClubHub` ок), а второй запрос страницы упал — `getClubAchievements` 503 (то же в `members/page.tsx:31` при сбое `getClubSettings`, `ratings/page.tsx:47`, `sessions/page.tsx:34`, `settings/page.tsx:71`). Страница отдаёт `<HubPanel hub={null}><ProductFrame><main>…`. `ClubHubFrame` стартует со `snapshot = hub` (не null) и сам рендерит `ProductFrame > main.hub > … > children`. В серверном HTML (и при каждой клиентской смене вкладки до эффекта) получаются две шапки/навигации ProductChrome и `<main>` внутри `<main>` — дубли landmark-ов для скринридера и видимое мигание. После эффекта `publish(null)` фрейм убирает свитчер и вкладки Club, хотя Hub доступен: пользователь не может перейти на Overview, только «Back to your Clubs».
- Fix: `ClubHubFrame` всегда оборачивает в `ProductFrame` (с `clubItems`, только когда есть snapshot), а failure-блоки страниц перестают рендерить `ProductFrame`/`main`. Страницы, у которых Hub загрузился, а упала только своя секция, передают `HubPanel hub={hub}`, а не `null`. Удаляет 6 обёрток `ProductFrame`; ложится на будущий `HubLoadFailure` из #38.
- Losing functionality: нет — те же тексты, Retry и «Back to your Clubs»; при сбое самого Hub фрейм по-прежнему без вкладок.

### E2. После входа пользователь не возвращается на members, sessions и past/new (`packages/contracts/src/auth/return-target.ts:13`)

- Case: вышедший пользователь открывает `/clubs/<id>/members`. `members/page.tsx:29` вызывает `buildLoginPath('/clubs/<id>/members')`, но allowlist пропускает только `''|/settings|/sessions/new|/achievements` (и ratings отдельно). `resolveAuthReturnTarget` молча подменяет на `/app` — после входа человек попадает в последний Club, а не на Members. То же для `sessions/page.tsx:32` (`/clubs/<id>/sessions`) и `sessions/past/new/page.tsx:29`. Вызывающие стороны не согласны с контрактом функции.
- Fix: дополнить регэксп `(?:\/settings|\/sessions\/new|\/achievements|\/members|\/sessions|\/sessions\/past\/new)?` и добавить строки в тест return-target.
- Losing functionality: нет; список по-прежнему закрытый, только UUID-пути одного origin.

### E3. Успешный отзыв приглашения показывается как ошибка (`apps/frontend/src/app/(product)/clubs/[clubId]/(hub)/settings/invitation-actions.ts:34`)

- Case: Admin нажимает Revoke; `revokeInvitation` прошёл, а следующий за ним `listInvitations` упал по таймауту → весь `try` уходит в catch → «Invitations could not be updated. Check your connection», ссылка остаётся в списке как pending. Повторный Revoke получает 404/409 → «Invitation management is no longer available to you» (`ACCESS_LOST_STATUSES`). Для создания та же ситуация обработана (`refreshError`), для отзыва — нет. Плюс клиент вызывает отзыв как `run('create', inviteId)` (`InvitationCard.tsx:154`, `:174`): одна функция action делает два дела по необязательному параметру, а «create» означает revoke.
- Fix: разделить на `createInvitationAction(clubId)` и `revokeInvitationAction(clubId, inviteId)`. Обе после изменения обновляют список одинаково (через `loadInvitationsAction`, с `refreshError`). В `InvitationCard.run` передавать саму action, без `kind`/`inviteId`. Добавить тест «revoke ок + list упал → ok: true, refreshError».
- Losing functionality: нет; поведение создания не меняется, отзыв получает тот же мягкий путь.

### E4. Одинаковые имена у кнопок «Revoke invitation» в списке (`apps/frontend/src/app/(product)/clubs/[clubId]/(hub)/settings/_components/ClubSettings/InvitationCard.tsx:212`)

- Case: при 5 pending-ссылках скринридер в списке кнопок слышит пять одинаковых «Revoke invitation» и не понимает, какую ссылку отзывает (видимый текст строки с id `aria-label` перекрывает). DESIGN/AGENTS: семантические имена контролов.
- Fix: `aria-label={\`Revoke invitation ${invite.id.slice(0, INVITATION_ID_LENGTH)}\`}`или убрать`aria-label`и связать кнопку со строкой через`aria-describedby`.
- Losing functionality: нет.

## Should fix

### E5. Сетевые ошибки и таймауты API нигде не логируются (`apps/frontend/src/lib/api.server.ts:73`)

- Case: backend недоступен (ECONNREFUSED) или запрос превысил 10 с. `requestApi` логирует только ответы 429/5xx; отказ самого `fetch` (TypeError/TimeoutError) пролетает без лога. Дальше его молча глотают: `library/load-library-read.ts:13-18` (возвращает `null`), `(hub)/layout.tsx:20`, `(hub)/page.tsx:57-69`, `app/page.tsx:75-79`, hub-вкладки (#38). Пользователь видит «temporarily unavailable», в логах сервера — ничего. AGENTS: «Never swallow errors… log and rethrow».
- Fix: в `requestApi` обернуть `fetch` в `try/catch`: `console.error('Backend request did not complete.', { name: error.name })` и `throw error`. Одна точка покрывает все загрузчики страниц; не логировать путь и заголовки.
- Losing functionality: нет; добавляется только строка лога.

### E6. Два механизма «ошибка API → текст» плюс третий ручной (`apps/frontend/src/app/(product)/clubs/[clubId]/(hub)/settings/actions.ts:38`, `.../settings/club-errors.ts:22`, `apps/frontend/src/app/(product)/clubs/new/actions.ts:34`)

- Case: frontend AGENTS требует маппить сбой через `getFailureMessage` (`#lib/action-failure`), и так делают все Session-actions. Club settings используют свой `run` + `getClubFailureMessage(status, reason)`, а `createClubAction` — цепочку `instanceof` вручную. Не-API ошибки там не логируются (`run` превращает TypeError в 503-текст молча; `createClubAction` возвращает fallback без лога). Чтобы добавить новый reason (например, `INVITATION_TARGET_UNAVAILABLE`), нужно знать, какой из трёх механизмов у этого экрана.
- Fix: `CLUB_FAILURE: IFailureCopy` (`reasons` = текущие `CONFLICT_MESSAGES`, `statuses` = 400/401/403/404/409, `fallback`) и `getFailureMessage(error, CLUB_FAILURE)` внутри `run`; то же в `createClubAction`. `club-errors.ts` и его спек свести к этой копии.
- Losing functionality: нет — те же тексты, плюс лог неожиданных сбоев.

### E7. Server action `changeClubLifecycleAction` не проверяет `action` (`apps/frontend/src/app/(product)/clubs/[clubId]/(hub)/settings/actions.ts:103`, `apps/frontend/src/api/clubs.server.ts:60`)

- Case: server action — публичная POST-граница (`_docs/security.md`), тип `TClubLifecycleAction` в runtime не проверяется. Запрос с `action='invitations'` превратится в `POST /clubs/<id>/invitations {confirmation}`, с `'sessions'` — в `POST /clubs/<id>/sessions`; при `'avatar'` и т. п. — в любой одиночный POST-сегмент. Права проверяет backend, поэтому эскалации нет, но action вызывает не тот endpoint, а сообщение об успехе для всего, что не `archive`, — «Club reactivated.».
- Fix: `z.enum(['archive', 'reactivate', 'leave', 'delete']).safeParse(action)` в начале action; при неудаче вернуть `next(previous, 'error', …)`.
- Losing functionality: нет.

### E8. `changeRosterAction` перед каждым изменением делает лишний `getSession` (`apps/frontend/src/app/(product)/sessions/[sessionId]/roster-actions.ts:37`)

- Case: Join/Leave/Kick/Revoke сначала читают всю Session, чтобы узнать `clubId` для `revalidatePath` (строка 44). Если этот GET отвечает 503 или таймаутом, сама команда roster не отправляется, и пользователь видит «Check your connection» из-за запроса, который ему не нужен. Остальные Session-actions делают `revalidatePath('/clubs/[clubId]', 'layout')` без чтения.
- Fix: убрать `getSession`, использовать `revalidatePath('/clubs/[clubId]', 'layout')` как в `actions.ts:16`.
- Losing functionality: нет — Hub-кэши сбрасываются так же (даже шире).

### E9. Одна и та же Session называется по-разному в разных блоках Hub (`apps/frontend/src/app/(product)/clubs/[clubId]/_components/HubOverview/HubOverview.tsx:89`)

- Case: Session с topic «Horror night» и выбранным фильмом «Alien». Overview → Recent Activity и Session history (`HubOverview.tsx:89`, `:112`) показывают «Horror night» (topic первым); вкладка Sessions (`HubSessions.tsx:49`) и карточки Active Ratings (`HubSessionCards.tsx:27`) — «Alien» (фильм первым); Call Sheet (`CallSheet.tsx:39-41`) — по фазе. Одно правило применено тремя способами.
- Fix: один `getSessionTitle(session)` (рядом с компонентами Hub или в `lib/format`) с решённым порядком (по Call Sheet: в фазах с фильмом — фильм, иначе topic) и использование во всех четырёх местах.
- Losing functionality: нет; меняется только непоследовательный текст.

### E10. Cookie последнего Club задаётся в четырёх местах с копией опций (`apps/frontend/src/app/(product)/app/actions.ts:26`)

- Case: имя `'pickflick.last_club'` и `{ httpOnly, sameSite: 'lax', secure, path }` повторены в `proxy.ts:47,58-63`, `app/actions.ts:26-31`, `clubs/new/actions.ts:27-32`, чтение — `app/page.tsx:81`. Если поменять опции (например, добавить `maxAge`), это нужно сделать трижды; пропуск даст две cookie с разными атрибутами.
- Fix: `lib/last-club.ts` с `LAST_CLUB_COOKIE` и `LAST_CLUB_COOKIE_OPTIONS`; все места используют их. (Отдельно стоит проверить, нужен ли вообще `selectClubAction`: `proxy.ts` уже авторизует Hub и ставит cookie на GET `/clubs/:id`, а `ClubSwitcher` мог бы делать `router.push`. Не предлагаю удалять без проверки, что proxy срабатывает на redirect из server action.)
- Losing functionality: нет.

### E11. Нет unit-тестов у граничного кода API-слоя и Session-actions (`apps/frontend/src/lib/api.server.ts:62`, `apps/frontend/src/lib/action-failure.ts:17`, `apps/frontend/src/api/session.server.ts:18`, `apps/frontend/src/app/(product)/sessions/[sessionId]/roster-actions.ts:24`)

- Case: `requestApi` (разбор envelope → `ApiError.reason`, пустое тело 202/204 → `undefined`, `content-type` для JSON и тела-буфера), `getFailureMessage` (reason раньше status, порядок групп status, fallback логируется) и `getSessionState` (5xx/таймаут → `unavailable`, а **не** `anonymous` — иначе страницы редиректят на вход при сбое API) не покрыты ни одним спеком (`git grep` по spec-файлам). Сломай порядок проверок в `getFailureMessage` — Club/Session-тексты молча станут fallback, и ничего не упадёт. У `commandSchema` в roster-actions (discriminated union на публичной границе) тоже нет теста.
- Fix: `lib/__tests__/api.server.spec.ts` — 3 кейса `requestApi` с застабленным `fetch`; `action-failure.spec.ts` — 3 кейса; `session.server.spec.ts` — anonymous без cookie / authenticated / unavailable на 503 и таймауте; один спек на roster-action: неверный input → не вызывает API.
- Losing functionality: нет.

### E12. Межроутовые импорты actions и стилей (extends #34) (`apps/frontend/src/app/(product)/clubs/[clubId]/(hub)/members/_components/ClubMembers/ClubMembers.tsx:6`)

- Case: роут Members импортирует `settings/actions` и `settings/action-state` (`ClubMembers.tsx:6-7`); общий `_components/ActiveSessionCard.tsx:7` — `sessions/[sessionId]/roster-actions`; `ClubSwitcher.tsx:7` — `app/actions`. Стили: `sessions/past/new/page.tsx:14` и `loading.tsx:1` импортируют `../../new/page.module.scss` — чужой роут, что прямо запрещено `.agent-docs/rules/frontend-css.md` («Never import another route's or feature's module»). Если поменять страницу `sessions/new`, сломается past/new.
- Fix: Club-actions, которые нужны двум роутам, перенести на уровень `clubs/[clubId]/` (`club-actions.ts`, `action-state.ts`) — по тому же принципу, что #34 для Session; общий стиль формы Session перенести в `clubs/[clubId]/sessions/session-form-page.module.scss` (групповой корень).
- Losing functionality: нет, только перенос файлов.

## Nice to have

### E13. `ClubMembers` вызывает action в форме `useActionState` вручную (`apps/frontend/src/app/(product)/clubs/[clubId]/(hub)/members/_components/ClubMembers/ClubMembers.tsx:23`)

- Case: чтобы удалить участника, компонент собирает `FormData` с одним полем и передаёт фиктивный `initialClubActionState` как «previous», а результат кладёт в свой `message`/`isPending` — читатель должен знать сигнатуру `(clubId, id, previous, formData)`.
- Fix: `useActionState(removeClubMemberAction.bind(null, club.id, selected.id), …)` как в `ClubDangerZone.ConfirmAction`, либо отдельная action `(clubId, membershipId, confirmation)`.
- Losing functionality: нет.

### E14. Две server action, которые только делают `revalidatePath`, и `run` на два дела (`apps/frontend/src/app/(product)/sessions/[sessionId]/nomination-actions.ts:25`, `.../selection-actions.ts:46`)

- Case: `refreshNominationsAction` возвращает `{ok, message}`, `refreshSelectionAction` — `void`, хотя делают одно и то же; `SessionProgress` для той же задачи использует `router.refresh()`. Из-за первой `Nomination.run(action: 'submit' | 'refresh')` (`Nomination.tsx:30-50`) ветвится по строке.
- Fix: кнопка обновления — `startTransition(() => router.refresh())` в обоих компонентах; удалить обе action; `Nomination` получает `handleSubmit` и `handleRefresh`.
- Losing functionality: нет — тот же повторный рендер серверных данных и офлайн-проверка.

### E15. Разбор итогов Selection отрисован дважды (`apps/frontend/src/app/(product)/sessions/[sessionId]/_components/SelectionOutcome/SelectionOutcome.tsx:33`, `.../Completed/Completed.tsx:130`)

- Case: число бюллетеней, шкала, `SELECTION_REASONS`, «No ballots», ranking с Top-score votes/Supporters повторены в двух компонентах с уже разошедшимися текстами («All totals are zero; the tie-break rules chose the winner» есть только в одном). Новая метрика ranking потребует правки в двух местах.
- Fix: общий `SelectionBreakdown({ breakdown, variant })` в `_components`, две раскладки (с постерами/details и без) — через проп.
- Losing functionality: нет.

### E16. Обёртки, которые только передают дальше (`apps/frontend/src/app/(product)/clubs/[clubId]/_components/ClubHubFrame/ClubHubFrame.tsx:28`)

- Case: `publish = useCallback((value) => setSnapshot(value), [])` — `setSnapshot` и так стабилен; `ClubHubPage` (`(hub)/page.tsx:78-80`) только рендерит `HubContent`; `getRequestTime` (`sessions/[sessionId]/page.tsx:76-78`) — `async` вокруг `Date.now()`, чтобы положить её в `Promise.all`.
- Fix: передавать `setSnapshot`; сделать `HubContent` default export; `const renderedAt = Date.now()` после `connection()` (комментарий «почему» оставить).
- Losing functionality: нет.

### E17. «12 hours» захардкожено трижды (extends #65) (`apps/frontend/src/app/(product)/clubs/[clubId]/(hub)/settings/_components/ClubSettings/InvitationCard.tsx:95`)

- Case: строки 95, 123, 149 повторяют `CLUB_INVITE_LIFETIME_MS` из backend; поменяют срок — UI будет врать.
- Fix: `CLUB_INVITE_LIFETIME_HOURS` в contracts, backend и UI читают его.
- Losing functionality: нет.

### E18. Адрес backend по умолчанию продублирован (`apps/frontend/src/api/session.server.ts:10`)

- Case: `process.env.BACKEND_INTERNAL_URL ?? 'http://127.0.0.1:3001'` — в `lib/api.server.ts:8`, `api/session.server.ts:10` и `next.config.ts:12`.
- Fix: экспортировать `BACKEND_URL` из `lib/api.server.ts` и импортировать в `session.server.ts`.
- Losing functionality: нет.

### E19. Тест таймаута деталей фильма на 50 строк проверяет одну константу (`apps/frontend/src/api/__tests__/movies.server.spec.ts:46`)

- Case: фейковые таймеры, стаб `AbortSignal.timeout`, «три вызова провайдера» внутри застабленного `fetch` backend-а — по сути проверяется только, что `timeoutMs` = 100 000. Название вводит в заблуждение: провайдера на этом уровне нет.
- Fix: `expect(requestApi).toHaveBeenCalledWith('/movies/<id>', { timeoutMs: 100_000 })`.
- Losing functionality: нет; таймаут `AbortSignal` уже проверяет сам `requestApi`.

### E20. Вкладки Library описаны дважды (`apps/frontend/src/app/(product)/library/loading.tsx:10`)

- Case: `loading.tsx:10-14` повторяет список из `LibraryShell.tsx:41-57`; новая вкладка появится в одном месте.
- Fix: `LIBRARY_TABS` рядом с `library-path.ts`, оба места мапят его.
- Losing functionality: нет.

### E21. Имена (extends #46/#47) (`apps/frontend/src/app/(product)/clubs/[clubId]/(hub)/settings/_components/ClubSettings/ManageModerators.tsx:18`)

- Case: boolean-props без префикса: `writable` (`ManageModerators.tsx:18`), `unavailable` (`(hub)/page.tsx:23`), `forbidden` (`settings/page.tsx:24`), `compact` (`ActiveSessionCard.tsx:18`), `disabled`/`pending` своих компонентов `SaveRow.tsx:10-11`. Расплывчатые: `selected` (`ClubMembers.tsx:16` — это участник к удалению), `current` (`ClubHubFrame.tsx:30` — секция), `i` (`ClubSwitcher.tsx:128`), `run`/`next` (`settings/actions.ts:29,38`).
- Fix: `isWritable`, `isUnavailable`, `isForbidden`, `isCompact`, `isPending`; `memberToRemove`, `currentSection`, `dotIndex`, `toActionState`/`runClubRequest`.
- Losing functionality: нет.

### E22. Повторный разбор формы Club (`apps/frontend/src/app/(product)/clubs/new/actions.ts:15`)

- Case: `createClubAction` вызывает `parseClubValues`, а при ошибке `validateClubValues`, который парсит заново; `updateClubSettingsAction` (`settings/actions.ts:60-64`) сам повторяет `Number(...)`-преобразование шкалы, которое уже есть в `parseClubValues`.
- Fix: при ошибке `toFieldErrors(parsed.error, FIELD_MESSAGES)` (экспортировать messages); для update — общий `toClubRequestFields(values)`.
- Losing functionality: нет.

### E23. Серверная ошибка Past Session обещает подсветку, которой нет (`apps/frontend/src/app/(product)/clubs/[clubId]/sessions/past/new/actions.ts:41`)

- Case: если клиентская и серверная схема разошлись (или запрос подделан), action отвечает «Review the highlighted fields», но `fieldErrors` не возвращает — ничего не подсвечено.
- Fix: текст «Some entries are invalid. Review the form and try again.» (или вернуть `fieldErrors` через `toFieldErrors`).
- Losing functionality: нет.

## Checked and fine

- `apiPath` кодирует каждый ID одним сегментом и отбрасывает `.`/`..`; тест есть. Во все `api/*.server.ts` первым стоит `import 'server-only'`; клиентские компоненты импортируют только server actions и `#lib/offline`/`format`/`form-errors`, server-only модули в клиентский бандл не попадают.
- `buildVisitorHeaders` пересылает только cookie и адрес клиента (тест есть); секретов в клиентском коде нет; `APPLE_SIGN_IN_ENABLED` читается только на сервере.
- Redirect-ы после входа идут через `resolveAuthReturnTarget` (allowlist, UUID-пути), open redirect невозможен (кроме E2 — там лишь потеря цели).
- Все Session-actions валидируют input zod-схемой из contracts до вызова API; ID в путях защищены `apiPath`, backend проверяет UUID.
- Пагинация Club Ratings/Library: backend ограничивает `page` значением `pages ≥ 1`, поэтому кнопки Next/Previous не уходят за край.
- `loadActiveSession` в settings логирует сбой и оставляет карточку read-only; `loadFilm` в Session логирует и показывает Alert.
- Детали фильма: `NOT_FOUND` приходит как `200 unavailable`, поэтому `RelatedMovies` с `Promise.all` не роняет страницу на неизвестном похожем фильме (только на 401, что корректно).
- Права в UI берутся из `permissions` сервера (`manageSettings`, `manageMembers`, `createInvitations`, `manageSessions`); лимит pending-ссылок в UI совпадает с backend (`memberLimit`).
- Кнопки удаления участника, refresh в PhaseProgress, текстовые кнопки settings — 44px (`var(--hit)`); фокус возвращается на заголовок после удаления участника, смены фазы, отправки бюллетеня/оценки.
- `StoredClubInfo`/`StoredVisibility` нужны: `updateClubSettingsSchema` — strict и полный, PATCH не частичный.
- Состояния: loading (`loading.tsx` для Hub, Session, Movie, Library, past/new), offline (`getOfflineMessage` перед мутациями), empty (Clubs, Ratings, Library, nominations), invalid filters, unauthorized → login, read-only notice в settings, destructive confirmation через `ConfirmDialog` с вводом слова.

Отброшено как мелочь (не вошло): ещё 3 пункта — `ActiveSessionCard` строит `/sessions/undefined` при отсутствии Session (не рендерится), дубль `isDecisionPhase` в `SessionHeader`/`SessionLines`, селекторы фокуса по `[role="radiogroup"]`/`[tabindex="0"]` в `Selection`/`RatingForm`.
