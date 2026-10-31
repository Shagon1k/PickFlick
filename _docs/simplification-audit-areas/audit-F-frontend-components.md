# Area: F — Frontend components, shells and non-product routes

Read: `apps/frontend/src/components/**` (ui, shells, movies, sessions, clubs, achievements, navigation — все `.tsx/.ts`, тесты в `__tests__`, SCSS выборочно по найденным вопросам: reduced motion, размеры целей, токены, film-ticket), `apps/frontend/src/app/(marketing)/**`, `(auth)/**`, `(internal)/**`, корневые `layout.tsx`, `error.tsx`, `global-error.tsx`, `not-found.tsx`, `robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `src/proxy.ts` (+ `src/__tests__/proxy.spec.ts`), `src/lib/security-headers.ts`, `src/styles/{tokens,globals}.scss`, `next.config.ts`, `package.json`. Сверял с `apps/frontend/AGENTS.md`, `.agent-docs/rules/frontend-css.md`, `DESIGN.md` §6/§8, `_docs/design/prototypes/DESIGN.md` (кнопки, `--hit`), `_docs/security.md`, Next 16 docs (`error.md`, `content-security-policy.md`), исходник Mantine `ColorSchemeScript`. Прогнал ESLint только для замера (cognitive 8, 60 строк на функцию).

Not read: SCSS-модули построчно целиком (868 строк `marketing.module.scss`, 910 `product-navigation.module.scss`, 629 `shells.module.scss`) — смотрел только места, на которые указывали находки; `(internal)/ui-preview/page.tsx` и его `_components` — бегло (галерея, не продукт).

Уже известное и не повторяю: #20/#37 (phase-close компоненты, render-props), #21 (шаблон мутации/«could not reach»), #22 (NotificationsProvider), #23 (`useSyncExternalStore`-трюк), #34/#35 (структура sessions/shells), #42/#48 (NotificationItems, Achievements JSX), #43 (голые boolean-аргументы), #58 (`aria-label` на `span` в мобильном бейдже), #65/#66 (дубли значений и дат), #72 (брейкпоинты).

## Must fix

### F1. `/legal/constructor` и `/legal/__proto__` дают 500 вместо 404 (`apps/frontend/src/app/(marketing)/legal/[document]/legal-content.ts:48`)

- Case: `isLegalDocumentName` проверяет `value in legalDocuments`, а `in` смотрит и цепочку прототипов. `GET /legal/constructor` (или `toString`, `__proto__`, `hasOwnProperty`) проходит проверку, `legalDocuments['constructor']` — это функция `Object`, и `legalDocument.sections.map` в `page.tsx:72` падает с TypeError. Любой анонимный посетитель получает «Projector Malfunction» и ошибку в логе вместо 404. `dynamicParams` не выключен, поэтому такие параметры рендерятся по запросу.
- Fix: `return Object.hasOwn(legalDocuments, value);` (или `export const dynamicParams = false;` в `page.tsx` — список документов статичен). Плюс один unit-тест на `isLegalDocumentName('constructor') === false`.
- Losing functionality: нет; `privacy` и `terms` открываются как раньше.

### F2. Кнопки выбора трейлера — 32px при обязательных 44px (`apps/frontend/src/components/movies/TrailerPlayer/TrailerPlayer.module.scss:28`)

- Case: у фильма 2–3 трейлера → на телефоне чипы `.choice` над плеером имеют `min-height: 32px`. AGENTS.md («44px targets») и DESIGN.md требуют 44px. Исключение в design contract есть только у `.btn-sm` (36px), трейлерных чипов в контракте нет. Автоматическая 44px-проверка их не ловит: чипы появляются только при >1 трейлере.
- Fix: `min-height: var(--hit);` (ширина остаётся как есть; при необходимости уменьшить вертикальный padding контейнера `.choices`).
- Losing functionality: нет, меняется только высота цели.

## Should fix

### F3. `ThemeScript` ничего не делает, а `headers()` в layout тайно держит весь CSP на nonce (`apps/frontend/src/app/layout.tsx:13`, `apps/frontend/src/components/ui/ThemeProvider/ThemeScript.tsx:9`, `apps/frontend/src/proxy.ts:18,27`)

- Case: `ColorSchemeScript forceColorScheme="dark"` вставляет ровно `document.documentElement.setAttribute("data-mantine-color-scheme","dark")` (проверено в `@mantine/core/esm/.../ColorSchemeScript.mjs`). Серверный `<html>` уже несёт этот атрибут через `themeHtmlProps`. Скрипт, `x-nonce` в proxy и чтение `x-nonce` в layout нужны только ему. Но настоящая скрытая работа `await headers()` в `RootLayout` — сделать все страницы динамическими. Без этого Next не проставит nonce на свои скрипты (docs: «you must use dynamic rendering to add nonces»). Комментарий в proxy говорит «layout reads x-nonce for the theme script». Кто удалит лишний скрипт вместе с `headers()`, сломает CSP на статических страницах (landing, pricing, legal).
- Fix: удалить `ThemeScript.tsx`, `<head>` с ним и `requestHeaders.set('x-nonce', …)`. В `RootLayout` оставить `await connection();` с комментарием «Nonce-based CSP needs every page rendered per request». Тест `proxy.spec.ts:52` проверяет только наличие nonce в политике. После правки прогнать CSP-проверку Playwright.
- Losing functionality: нет; тёмная схема задаётся серверным атрибутом, Next продолжает ставить nonce.

### F4. `BRAND_ASSETS` вручную дублирует размеры картинок и хранит неиспользуемое поле (`apps/frontend/src/components/ui/BrandImage/brand-assets.ts:37-206`, `BrandImage.tsx:23-26`)

- Case: у всех 24 записей `width`/`height` совпадают с реальными размерами файла (сверил через `sips`) — то есть с `source.width`/`source.height`, которые Next уже кладёт в `StaticImageData`. Перерисуют `panda-hero.webp` в другой пропорции, забудут поправить число — картинка растянется. Поле `role` нигде не читается (`git grep`). Ключи названы по одной роли, а используются для другой: `proPlan` — маскот страницы 500 (`SystemState.tsx:12`).
- Fix: оставить `{ source, containsEmbeddedText? }` и брать в `BrandImage` `selected.source.width/height`. Удалить `width`, `height`, `role` (~70 строк). Проверку `width > 0` в `brand-assets.spec.ts` убрать, проверку текста в картинке оставить. Переименовать ключи по изображению (`projectionist`, `panda404`) — по желанию.
- Losing functionality: нет; размеры те же, флаг встроенного текста сохраняется.

### F5. Иконки и «текущий пункт» навигации вычисляются по видимому тексту ссылки (`apps/frontend/src/components/shells/NavigationItemIcon/NavigationItemIcon.tsx:9-38`, `apps/frontend/src/components/shells/ProductChrome/ProductChrome.tsx:49-56`)

- Case: пункт меню переименовали «My Library» → «Library». Иконка в film strip и боковой навигации молча становится `circle`, а в десктопной шапке пропадает подчёркивание текущего раздела: `item.label === 'My Library' && currentArea === 'library'`. Тестов, которые это поймают, нет. Одна строка отвечает сразу за три вещи: за текст, иконку и активность.
- Fix: добавить `icon: TIconName` в `IShellNavigationItem`/`IShellActionItem`. Мобильные группы уже так устроены (`shell-navigation.ts:28`). Заполнить `icon` в `build*Navigation`, а `NavigationItemIcon` превратить в `<Icon name={item.icon} />` или удалить. `buildProductNavigation(routes, currentArea)` сам ставит `current`, сравнение подписей в `ProductChrome` уходит.
- Losing functionality: нет; набор иконок и подсветка те же.

### F6. Две страницы приглашений — почти копии, и их поведение уже разошлось (`apps/frontend/src/app/(auth)/invite/club/[token]/page.tsx`, `.../session/[token]/page.tsx`, оба `page.module.scss`, оба `_components/Invitation/Invitation.tsx`)

- Case: `page.tsx` совпадают построчно, кроме API и текста. `page.module.scss` — 129 одинаковых строк из 142. Расхождения уже появились: (а) в Session-приглашении при `state: 'error'` нет «Try again» (`session/.../Invitation.tsx:96-100`), хотя DESIGN требует для ошибки «safe retry». У Club-приглашения retry есть (`club/.../Invitation.tsx:140-144`). (б) Club-приглашение не проверяет `getOfflineMessage` перед отправкой (`club/.../Invitation.tsx:61`), Session-приглашение проверяет, а `apps/frontend/AGENTS.md` требует проверку. (в) Club строит `returnTo` через `resolveAuthReturnTarget`, Session — нет.
- Fix: общий `(auth)/invite/invite.module.scss` (frontend-css.md разрешает таблицу стилей на корне группы), в club-модуле оставить только `.previewMeta`. Добавить «Try again» в Session error, `getOfflineMessage` — в Club `respond`. Сами `Invitation` не сливать: у них разные состояния.
- Losing functionality: нет; добавляются требуемые retry и offline-ответ.

### F7. На landing и pricing скопированы блок Free-плана и «SprocketDivider», а лимиты плана записаны в четырёх местах (`apps/frontend/src/app/(marketing)/page.tsx:19-21,124-158`, `apps/frontend/src/app/(marketing)/pricing/page.tsx:22-30,172-202`, `marketing-content.ts:69-105`)

- Case: Free-лимит участников меняется с 8 на 10. Править нужно `page.tsx:139`, `pricing/page.tsx:186`, `freePlanFeatures` и `comparisonRows`. Тест `marketing-content.spec.ts` смотрит только content-файл, обе копии handoff он не видит. Ещё в обеих страницах есть локальная функция `SprocketDivider` (в двух версиях разметки: с `<i>` и без), хотя в UI-ките есть компонент `SprocketDivider` с другим видом. Одно имя обозначает две разные вещи.
- Fix: `(marketing)/_components/PlanHandoff/PlanHandoff.tsx` (заголовок через props, факты — из одной константы `FREE_PLAN_LIMITS` в `marketing-content.ts`, её же используют `freePlanFeatures`/`comparisonRows`). Локальный делитель переименовать в `SectionDivider` и вынести рядом.
- Losing functionality: нет; разметка и текст те же.

### F8. 11 блоков `prefers-reduced-motion` в компонентах — мёртвый код, и они противоречат глобальному правилу (`apps/frontend/src/styles/globals.scss:73-84`)

- Case: глобально стоит `*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0.01ms !important }` с комментарием «Zero, not 0.01ms: a stretched visibility switch keeps opened overlays unfocusable». Компонентные блоки ставят `transition-duration: 0.01ms` / `animation-duration: 0.01ms` без `!important`, поэтому никогда не применяются. Но выглядят как правильный образец: удалят глобальное правило — вернётся та самая ошибка фокуса. Мёртвые блоки: `ui/Tabs/Tabs.module.scss:66-71`, `ui/InfoTip/InfoTip.module.scss:84-89`, `ui/ScaleControl/ScaleControl.module.scss:110-119`, `ui/Field/Field.module.scss:116-120`, `ui/Button/Button.module.scss:221-230`, `ui/Switch/Switch.module.scss:85-90`, `ui/LoadingState/LoadingState.module.scss:182-192`, `ui/FilmStripMenu/FilmStripMenu.module.scss:151-156`, `clubs/PendingInvites/PendingInvites.module.scss:211-215`, `shells/shells.module.scss:623-628`, `shells/product-navigation.module.scss:832-844`.
- Fix: удалить эти блоки (~80 строк). Блоки с `transform: none`, `animation: none`, `opacity: 1` (marketing, MovieMedia, SystemState) и `SelectionScaleField.module.scss:122-126` оставить: `::-webkit-slider-thumb` под `*` не попадает.
- Losing functionality: нет; глобальное правило уже действует на эти элементы.

### F9. Обвязка поля скопирована в TextInput, Textarea и Select (`apps/frontend/src/components/ui/TextInput/TextInput.tsx:27-48`, `Textarea/Textarea.tsx:39-72`, `Select/Select.tsx:47-100`)

- Case: в трёх местах повторяются одинаковые `classNames.root/label/description`, `data-state`, `description={<FieldMessage …/>}`, `error={Boolean(error)}`, `inputContainer` с `FieldAnnouncements`, `inputWrapperOrder`, `label={<FieldLabel …/>}`, `withAsterisk={false}`. Поменять поведение live-регионов или порядок слотов значит повторить правку трижды; уже сейчас Select именует импорт `fieldStyles`, а остальные — `styles`.
- Fix: функция `getFieldProps({ error, hint, label, labelHint, success })` в `Field/field.types.ts`, возвращающая общие props. Три обёртки добавляют только своё: класс `input`, счётчик Textarea, скрытый required-input Select.
- Losing functionality: нет.

### F10. Фильтры Achievements: `aria-label` на `div` без роли (`apps/frontend/src/components/achievements/Achievements/Achievements.tsx:38`)

- Case: скринридер не объявит «Achievement filters»: ARIA запрещает давать имя элементу без роли. Три `aria-pressed`-кнопки звучат без общего контекста. Та же ошибка, что #58, в новом месте (extends #58).
- Fix: `role="group"` на этом `div`.
- Losing functionality: нет.

### F11. Server actions доверяют аргументам без проверки на границе (`apps/frontend/src/components/clubs/PendingInvites/actions.ts:44-56`, `apps/frontend/src/components/sessions/SessionForm/actions.ts:38`)

- Case: `respondPendingInviteAction(id, decision, kind)` — публичная граница. При любом `kind`, кроме `'session'`, запрос уходит на Club-эндпоинт, `id` не проверяется. Кроме того, `encodeURIComponent(id)` вызывается до `apiPath`, а `apiPath` кодирует сегмент ещё раз (`lib/api.server.ts:45`): id с `%` превращается в `%2525`. `saveSessionAction(clubId, id, …)` тоже не проверяет `clubId`/`id`. При этом соседние `setWatchlistAction` и `savePersonalRatingAction` проверяют `movieIdSchema`. Одно правило применяется по-разному.
- Fix: убрать оба `encodeURIComponent`. Проверять `id`/`clubId` uuid-схемой из contracts, `kind` — `z.enum(['club','session'])`, при ошибке возвращать то же сообщение, что для неверного `decision`.
- Losing functionality: нет; для корректных UUID поведение не меняется.

### F12. Детали UI-кита, которые использует только `/ui-preview` (`apps/frontend/src/components/ui/FilmStripMenu/FilmStripMenu.tsx:18-19,136-146`, `apps/frontend/src/components/ui/EmptyState/EmptyState.tsx`)

- Case: ветку `href`/`current` в `FilmStripMenu` использует только `PreviewMenus.tsx` с якорями `#navigation`/`#forms`. Продукт (`SessionHeader.tsx:149`) передаёт только `onSelect`. При этом ветка рендерит обычный `<a>` через `component="a"`: если первый продуктовый пункт со ссылкой на страницу приложения пойдёт через неё, навигация будет полной перезагрузкой, вопреки правилу `next/link` из `apps/frontend/AGENTS.md`. `EmptyState` не импортирует ни один продуктовый файл, в таблице компонентов DESIGN.md §6 его нет; пустые состояния в продукте свёрстаны по-своему (`overlayEmpty`, `Table__empty`).
- Fix: удалить `href`-вариант и `current` из `TFilmStripMenuItem`, а в галерее заменить ссылки на `onSelect`. `EmptyState` удалить вместе с его секцией в галерее или использовать в продуктовом пустом состоянии — решение владельца.
- Losing functionality: продуктового поведения не теряется; в галерее пропадает демонстрация ссылок в film strip.

## Nice to have

### F13. Общий `film-ticket.module.scss` импортируют два роута и компонент, и импорт назван не `styles` (`apps/frontend/src/components/movies/film-ticket.module.scss`, `TicketPoster.tsx:4`, `sessions/[sessionId]/_components/SessionHeader/SessionHeader.tsx:6`, `movies/[movieId]/_components/MovieHero/MovieHero.tsx:4`)

- Case: frontend-css.md говорит: «No shared component stylesheets… Never import another route's or feature's module». Исключение описано только для `components/shells`. Новичок, прочитав правило, не поймёт, можно ли так делать.
- Fix: дописать в frontend-css.md второе явное исключение, как для shells («film ticket: селекторы пересекают заголовки Movie и Session»), и оставить имя `ticket`. Код не трогать.
- Losing functionality: нет.

### F14. `ScaleControl` (180 строк) рендерит два разных контрола (`apps/frontend/src/components/ui/ScaleControl/ScaleControl.tsx:96-123` и `145-236`)

- Case: ветка `submitted` — read-only полоса из `span` со своей разметкой. Остальное — radiogroup с roving tabindex, preview и скрытым required-input. Читатель держит в голове обе ветки и общий state, хотя `submitted` из него почти ничего не использует.
- Fix: вынести `SubmittedScale({ label, values, selectedValue, presentation, compact, max })`. `ScaleControl` в начале делает `if (submitted) return <SubmittedScale …/>`, но только после всех хуков, как сейчас.
- Losing functionality: нет.

### F15. Дедлайн Nomination считается по часам браузера (`apps/frontend/src/components/sessions/SessionForm/session-form.ts:35-42`)

- Case: часы ноутбука спешат на 2 часа, пользователь вводит «01:00». `deadlineAt` = браузерное `now + 1h`, по серверу это уже прошедшее время, и сервер отвечает `DEADLINE_PAST` («The nomination deadline has passed»), хотя пользователь задал час вперёд. Если часы отстают — дедлайн получается на 3 часа.
- Fix (по правилу владельца о shortcut): комментарий `// shortcut: deadline uses the browser clock; revisit if skewed clocks show up in DEADLINE_PAST reports`. Полное решение — передавать длительность и считать на сервере, но это меняет контракт.
- Losing functionality: нет.

### F16. Карта маршрутов `IShellRouteMap`: мёртвый ключ и ключ, который путает с доменной Session (`apps/frontend/src/components/shells/shell-navigation.ts:46-82`, `ProductShell.tsx:47`, `SessionShell.tsx:32`)

- Case: `setup: '/login'` нигде не читается, кроме самой карты и галереи. `session: '/app'` ведёт на Hub, а не на Session, и выглядит как доменное понятие. Подстановка по умолчанию записана двумя способами: параметр `routes = canonicalRoutes` и `routes?.x ?? canonicalRoutes.x`.
- Fix: удалить `setup`, `session` заменить на `product` (то же значение), везде одинаково использовать параметр по умолчанию `routes = canonicalRoutes`.
- Losing functionality: нет; галерея (`previewRoutes`) продолжит работать.

### F17. Неиспользуемые токены рядом с захардкоженными почти-дублями (`apps/frontend/src/styles/tokens.scss:115-116,130`, `apps/frontend/src/app/(marketing)/marketing.module.scss:85-86,104-105`, `shells/shells.module.scss:100,114,148,239,265`, `shells/product-navigation.module.scss:47,58,332,485,579,707,752`, `ui/FilmStripMenu/FilmStripMenu.module.scss:86-87`)

- Case: токен `--motion-editorial: 600ms` не используется, а marketing пишет `600ms` руками. Hover-переходы в шапках и меню заданы как `0.16s` / `0.18s` / `0.2s` в ~20 местах, при токене `--motion-local: 150ms`. Токены `--image-noir-rest/active` не используются нигде. frontend-css.md: «Never hard-code a near-duplicate».
- Fix: `600ms` → `var(--motion-editorial)`; `0.16s`/`0.18s` → `var(--motion-local)` (различие в 30мс не видно); `--image-noir-*` удалить из `tokens.scss`, их нет и в design contract.
- Losing functionality: нет (визуальная разница ≤ 30мс).

### F18. Глобальные стили `.scaffold-panel` нужны одной внутренней странице (`apps/frontend/src/styles/globals.scss:35-71`)

- Case: используются только в `(internal)/ui-preview/error-recovery/page.tsx:21-24`. По frontend-css.md в globals лежат только reset, body, focus и `.visually-hidden`.
- Fix: перенести в `ui-preview/error-recovery/page.module.scss` и использовать как `styles.*`.
- Losing functionality: нет.

### F19. Boolean-props без `is/has/…` (extends #46) — новые места

- Case: `open` (`Modal.tsx:12`, `ConfirmDialog.tsx:10`, `Popover.tsx:14`, `NotificationsPanel.tsx:11`, `CancelSessionDialog.tsx:14`), `pending` (`ConfirmDialog.tsx:17`), `compact` (`Progress.tsx:7`, `ScaleControl.tsx:10`), `submitted` (`ScaleControl.tsx:20`), `cell` (`SessionLink.tsx:15`), `signedIn` (`SystemState.tsx:27`), `appleSignInEnabled` (`LoginActions.tsx:12`), `hidePhonePoster` (`MovieMedia.tsx:19`), `alignEnd` (`FieldMessage.tsx:9`), `showCount` (`Textarea.tsx:21`), `dismissible` (`Modal.tsx:18`), `current` (`shell-navigation.ts:16`), `numeric` (`Table.tsx:8`).
- Fix: `isOpen`, `isPending`, `isCompact`, `isSubmitted`, `isCell`, `isSignedIn`, `isAppleSignInEnabled`, `shouldHidePhonePoster`, `shouldAlignEnd`, `shouldShowCount`, `isDismissible`, `isCurrent`, `isNumeric`. Пропсы, которые повторяют DOM/Mantine (`disabled`, `required`, `readOnly`, `fullWidth`), оставить.
- Losing functionality: нет.

### F20. В продуктовом тексте вернулось слово «group» (`apps/frontend/src/app/(auth)/login/page.tsx:57`)

- Case: «Sign in to join your group's screening room.» — AGENTS.md: «Never revive "Group"». Текст скопирован из прототипа (`login.html:260`), но прототип — не источник домена.
- Fix: «Sign in to join your Club's screening room.»
- Losing functionality: нет.

### F21. Числа, которые уже есть в contracts, записаны вручную (extends #65/#40)

- Case: `SelectionScaleField.tsx:9` `SELECTION_SCALE_CEILING = 10` при `CLUB_SELECTION_SCALE_CEILING` (его использует соседний `club-form.validation.ts:5`). `movie-search.ts:45` «1–200 characters» при `MOVIE_QUERY_MAX_LENGTH`. `contact-form.validation.ts:8-9` «500»/«100» при `CONTACT_MESSAGE_MAX_LENGTH`/`CONTACT_NAME_MAX_LENGTH`. `session-form.ts:75-77` «200»/«2000» при `SESSION_*_MAX_LENGTH`. Подписи типов Session: `SessionForm.tsx:264-267` и `SessionHeader.tsx:177-181`.
- Fix: импортировать константы и собрать текст шаблонной строкой, как в `club-form.validation.ts:17-22`; одна карта подписей типов Session в `components/sessions`.
- Losing functionality: нет.

### F22. Ещё копии форматирования дат (extends #66)

- Case: `PendingInvites.tsx:195-200` — inline `Intl.DateTimeFormat`. Срок «Expires» одного и того же приглашения показан в двух видах: `toIsoDate` («2026-10-30», `invite/session/.../Invitation.tsx:74`) и `formatUtcDate` («Oct 30, 2026», `PendingInvites.tsx:193`).
- Fix: `formatUtcDate` в обоих местах, для дня недели — хелпер в `lib/format.ts`.
- Losing functionality: нет.

### F23. Устаревшие документы

- Case: `apps/frontend/AGENTS.md` («`ControlShell` … layouts for later phases; only the `/shell-preview` gallery renders them»), хотя `ControlShell` рендерят `library/_components/LibraryShell/LibraryShell.tsx:35` и `library/loading.tsx:5`. `_docs/security.md`, таблица CSP: «`img-src 'self' data: blob:` plus catalog CDN origins», а `security-headers.ts:23` CDN не добавляет, и сам документ ниже пишет «CSP limits images to self, data and blob sources».
- Fix: убрать `ControlShell` из списка «later phases»; в security.md удалить «plus catalog CDN origins».
- Losing functionality: нет.

### F24. `proxy()` делает три несвязанные работы (`apps/frontend/src/proxy.ts:23-66`, cognitive 11)

- Case: nonce и CSP, скрытие превью и заголовки приглашений, авторизованное запоминание последнего Club с запросом в backend. Чтобы понять cookie-логику, нужно прочитать всю функцию с ранним `return` внутри `catch`.
- Fix: вынести `async function rememberLastClub(request, response): Promise<void>` (строки 43-64) — отдельная работа с отдельными тестами (`proxy.spec.ts:64-113`).
- Losing functionality: нет.

### F25. Текст подтверждения выхода из Session написан для чужого участника (`apps/frontend/src/components/sessions/SessionRoster/SessionRoster.tsx:131-134`)

- Case: пользователь нажимает Leave и видит: «End your participation? This participant will no longer count toward Session progress», а кнопка отмены — «Keep participation». Текст про третье лицо, хотя действие — про себя.
- Fix: для `isLeave` — «Leave this Session? You will no longer count toward Session progress. Your existing history stays.»
- Losing functionality: нет.

### F26. Комментарий не там и лишняя защитная проверка (`apps/frontend/src/components/ui/InfoTip/InfoTip.tsx:15-19`, `apps/frontend/src/app/(marketing)/_components/LandingReveal/LandingReveal.tsx:23-25`)

- Case: JSDoc компонента InfoTip стоит над `const EDGE_GAP_PX`, а не над функцией, и в IDE подсказка достаётся константе. В LandingReveal проверяется, что CSS Modules вернули класс (`if (!revealClass || !revealedClass) return`), — это контракт сборки, а не внешний ввод. Кроме того, `sections` и `reveal` вычисляются до ранних `return` и выбрасываются.
- Fix: поменять местами JSDoc и константу; удалить проверку классов и перенести `sections`/`reveal` ниже проверок reduced motion и IntersectionObserver.
- Losing functionality: нет.

### F27. `TicketPoster` молча теряет `corner`, если задан `href` (`apps/frontend/src/components/movies/TicketPoster/TicketPoster.tsx:24-36`)

- Case: сейчас ни один вызывающий не передаёт оба пропа. Но тип это разрешает: передадут `href` и `corner={<WatchlistBookmark/>}` в заголовок Session — ленточка Watchlist не появится, ошибки не будет.
- Fix: тип-объединение `{ href: string; corner?: never } | { href?: never; corner?: ReactNode }`.
- Losing functionality: нет.

## Checked and fine

- Return target при входе: `resolveAuthReturnTarget` — строгий allowlist путей и схем query (`packages/contracts/src/auth/return-target.ts`), его используют `login/page.tsx:30` и `auth-client`. Open redirect нет.
- `proxy.ts`: свежий nonce на каждый запрос; prefetch и статика исключены matcher'ом; превью в production переписываются на 404 даже при prefetch; `/invite/*` получает `no-referrer` и `private, no-store`; cookie последнего Club ставится только после успешной проверки Hub. Всё это покрыто `proxy.spec.ts`.
- `next.config.ts`: `poweredByHeader: false`, security headers на `/:path*`, проверка протокола `BACKEND_INTERNAL_URL`, `images.remotePatterns` не задан.
- `error.tsx` использует `retry` — так в Next 16.3+ (сверено с `node_modules/next/dist/docs`); `global-error.tsx` не зависит от Mantine и shell, кнопка 44px.
- Фокус: `Modal` (`trapFocus` + `returnFocus`), `Popover` (`trapFocus`, `returnFocus`), `useOverlayDismissal` с ловушкой Tab для панели уведомлений, аккаунта и поиска, возврат фокуса на триггер в `ProductOverlayProvider`, `FilmStripMenu` возвращает фокус на постоянный триггер перед открытием диалога.
- Цели 44px: кнопки панели уведомлений, «Mark as read», «Load more», PendingInvites Close, редактор Watchlist, InfoTip (зона нажатия через `::before inset -12px`). `Button size="small"` = 36px — по design contract (`.btn-sm`), не нарушение.
- `ScaleControl`: roving tabindex, стрелки/Home/End, `aria-checked`, скрытый required-input для ошибки ограничения; `Select` — аналогичный скрытый required-input.
- `TrailerPlayer`: до нажатия Play к YouTube ничего не уходит, используется `youtube-nocookie`, ID кодируется; внешние ссылки с `rel="noopener noreferrer"`.
- `BackLink`: `history.back()` только для same-origin referrer, иначе fallback-ссылка.
- Server actions Watchlist и Personal Rating проверяют `movieIdSchema` и ввод до вызова API; есть тесты (`WatchlistBookmark/__tests__/actions.spec.ts`, `movies/__tests__/actions.spec.ts`).
- Коды ошибок входа: allowlist сообщений, неизвестный код → общий текст (`login-errors.ts`).
- `robots.ts`/`sitemap.ts` строятся из одного `lib/indexing`; превью и приватные маршруты закрыты noindex через `NON_PUBLIC_INDEXING_BOUNDARIES`.
- Только UI-кит и `theme` импортируют `@mantine/*` (кроме `@mantine/form` в формах) — нарушений не нашёл.
- `ConfirmDialog`: Enter подтверждает только при совпавшем слове и без pending, поле сбрасывается при каждом открытии.

Отброшено как мелкое или спорное: 4 находки (жёсткий `32px` в размере `Modal`, привязка `PendingInvites` к повторной загрузке при каждом монтировании `ProductChrome`, пересоздание SSE при переходе между разделами без общего `(product)/layout`, однострочный `ScoreControl`, который повторяет default).
