# @pickflick/contracts

Shapes shared by the API and the web app.

- **Requests** are zod schemas named `<thing>Schema` with inferred `T<Thing>` types, for example
  `createClubSchema` and `TCreateClubRequest`. The API validates bodies with them
  (`ZodValidationPipe`); web forms reuse them.
- **Responses** are plain interfaces (`IClubSummary`, `IClubSettings`).
- **Errors:** `API_ERROR_CODES`, `IApiErrorEnvelope`, and per-domain conflict reasons such as
  `CLUB_CONFLICT_REASONS`.

Folders follow the domain: `auth/`, `clubs/`, `contact/`, and `common/` (errors, health, text
helpers). Export everything through `src/index.ts`. Tests live in each folder's `__tests__/`.

Movie DTOs use canonical UUIDs, nullable normalized fields, allowlisted HTTPS images, safe YouTube
trailer URLs, source/scale ratings and per-source provenance. Provider wire schemas are separate
from public summaries/details; backend provider records contain external correspondences and
never supply public Movie IDs. Only `en-US` is supported initially.
