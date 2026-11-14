# Personal ratings CSV

Use **Settings → Import & Export** to download or replace your current Personal Ratings.
This format does not contain historical Session Ratings, comments, Watchlist entries or another
user's data. Importing never changes shared Club or Session history.

## Version 1 format

Save the file as UTF-8, optionally with a BOM. The header has exactly these four columns in order:

```csv
version,movie_id,name,rating
1,10000000-0000-4000-8000-000000000001,"Example film",8
```

| Column     | Meaning                                                                          |
| ---------- | -------------------------------------------------------------------------------- |
| `version`  | Exactly `1` on every record.                                                     |
| `movie_id` | A canonical PickFlick Movie UUID that exists in the receiving catalog.           |
| `name`     | Descriptive text only; it never creates or matches a Movie.                      |
| `rating`   | A whole number from 1 through 10, with no spaces, decimal point or leading zero. |

Use commas as delimiters. Quote cells containing commas, quotes or line breaks; double embedded
quotes. LF, CRLF and CR record endings are accepted. A quoted multiline cell belongs to one
record. Feedback uses record numbers, including the header as record 1, rather than physical
line numbers. Empty records are invalid. One final record ending is allowed.

Import accepts at most 512 KiB, 1,000 ratings and 2,048 decoded characters per cell. Split larger
exports into files within both limits, keeping the header in each. Export includes all your
current ratings and may exceed the import limits. Empty exports contain only the header and can
serve as templates; an import needs at least one rating.

IDs are stable within the PickFlick catalog. Unknown IDs and duplicate IDs block import. The
format does not resolve names or provider IDs, create catalog records, or import arbitrary
third-party CSV layouts. Copying an export to a different catalog requires matching canonical IDs.

## Preview and import

Choose a file, then select **Preview import**. Review the new, changed and unchanged counts and
expand the valid-rating table to see the catalog title, current score and incoming score.
Every invalid record receives an error. Structural failures, invalid UTF-8 and exceeded limits
produce a file-level correction message. Fix all errors and preview again; no valid subset is
silently imported. Selecting a different file clears the previous preview.

**Confirm import** revalidates the submitted file and catalog before writing. All ratings commit
in one transaction. New or changed scores have `PERSONAL` source and the import time. Equal
scores preserve the existing source and update time, including a `SESSION` source. Repeated or
concurrent identical imports cannot create duplicate ratings or change those timestamps. A later
different import is an explicit new edit; it can replace a score saved since the preview.

After a connection failure, retry the import to establish the result. Cancellation before
confirmation writes nothing. Files and previews are not retained on the server.

## Spreadsheet safety and privacy

Exports quote every data cell and double embedded quotes. A name whose first non-whitespace or
control character is `=`, `+`, `-` or `@` receives a leading apostrophe. Import rejects unescaped
formula-like names with a correction message. It accepts the escaped text; names remain
descriptive and are never written to the catalog. Machine columns accept only their exact
version, UUID and integer syntax. No cell is evaluated as code or a spreadsheet formula.

The authenticated API derives ownership from the session and rejects query selectors. All
responses are private/no-store. Downloads are generated on request without public object URLs,
storage jobs or retained export files. The GDPR archive and its expiry policy belong to #67.

| API                                 | Request                                 | Response                                                   |
| ----------------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| `GET /library/ratings-csv`          | No query parameters                     | `{ csv, count }`                                           |
| `POST /library/ratings-csv/preview` | Raw `text/csv`, up to 512 KiB; no query | Validation result, no writes                               |
| `POST /library/ratings-csv/import`  | Same raw file; no query                 | Revalidated result with `imported: true` only after commit |

Both POST endpoints return HTTP 200 for a validation result. Invalid content has `imported: false`
and an `errors` array of `{ row, message }`. Valid `rows` carry record number, catalog Movie ID and
name, incoming/current scores and `create`, `update` or `unchanged` action. Oversized HTTP bodies
return 413 before parsing; authentication, query validation and persistence failures use the
existing API error envelope. The UI offers retry and sign-in recovery messages.
