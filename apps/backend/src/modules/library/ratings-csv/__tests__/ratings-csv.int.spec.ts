import { randomUUID } from 'node:crypto';

import {
    RATINGS_CSV_HEADER,
    RATINGS_CSV_MAX_BYTES,
    ratingsCsvExportSchema,
    ratingsCsvResultSchema,
} from '@pickflick/contracts';

import {
    createUser,
    type ITestApi,
    startTestApi,
    withFailingInsert,
} from '../../../../testing/integration.js';
import { removeUsers } from '../../../../testing/remove-users.js';

describe('RatingsCsv', () => {
    let api: ITestApi;
    let users: string[];
    let movies: string[];
    beforeAll(async () => {
        api = await startTestApi();
    });
    beforeEach(async () => {
        users = await Promise.all([createUser(api.prisma), createUser(api.prisma)]);
        movies = await Promise.all(
            ['Film, "One"', '=HYPERLINK("bad")'].map(
                async (title) => (await api.prisma.movie.create({ data: { title } })).id,
            ),
        );
    });
    afterEach(async () => {
        await removeUsers(api.prisma, users);
        await api.prisma.movie.deleteMany({ where: { id: { in: movies } } });
    });
    afterAll(async () => {
        await api.close();
    });
    const csv = () =>
        `${RATINGS_CSV_HEADER}\r\n1,${movies[0]},Descriptive name,8\r\n1,${movies[1]},Another name,6\r\n`;
    const upload = (body = csv(), action = 'import', userId = users[0]) =>
        api.request(`/library/ratings-csv/${action}`, {
            userId,
            method: 'POST',
            body,
            headers: { 'content-type': 'text/csv' },
        });
    const saved = () =>
        api.prisma.personalMovieRating.findMany({
            where: { userId: users[0] },
            orderBy: { movieId: 'asc' },
        });

    it('should preview without writes, import atomically and preserve identical ratings on repeated concurrent imports', async () => {
        const preview = ratingsCsvResultSchema.parse(await (await upload(csv(), 'preview')).json());
        expect(preview.rows.map((row) => row.action)).toEqual(['create', 'create']);
        expect(await saved()).toEqual([]);
        expect(ratingsCsvResultSchema.parse(await (await upload()).json()).imported).toBe(true);
        const before = await saved();
        const retries = await Promise.all([upload(), upload(), upload()]);
        expect(retries.map((response) => response.status)).toEqual([200, 200, 200]);
        expect(await saved()).toEqual(before);
        expect(before.map((rating) => rating.source)).toEqual(['PERSONAL', 'PERSONAL']);
    });

    it('should export only the caller, escape formulas and re-import the exact export without changing metadata', async () => {
        await upload();
        await api.prisma.personalMovieRating.create({
            data: { userId: users[1]!, movieId: movies[0]!, score: 2, source: 'SESSION' },
        });
        const response = await api.request('/library/ratings-csv', { userId: users[0] });
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        const exported = ratingsCsvExportSchema.parse(await response.json());
        expect(exported.count).toBe(2);
        expect(exported.csv).toContain('"\'=HYPERLINK(""bad"")"');
        expect(exported.csv).not.toContain(users[0]);
        const before = await saved();
        await upload(exported.csv);
        expect(await saved()).toEqual(before);
        const peer = ratingsCsvExportSchema.parse(
            await (await api.request('/library/ratings-csv', { userId: users[1] })).json(),
        );
        expect(peer.count).toBe(1);
        expect(peer.csv).toContain(',"2"');
    });

    it('should report all invalid rows and reject the whole file on direct import as well as preview', async () => {
        const body = `${csv()}1,${randomUUID()},Unknown,5\n1,${movies[0]},Invalid,12\n1,${movies[0]},Duplicate,4\n`;
        for (const action of ['preview', 'import']) {
            const result = ratingsCsvResultSchema.parse(await (await upload(body, action)).json());
            expect(result.errors.map((error) => error.row)).toEqual([4, 5, 6]);
            expect(result.imported).toBe(false);
            expect(result.rows).toHaveLength(2);
        }
        expect(await saved()).toEqual([]);
    });

    it('should revalidate at confirmation and change only the current caller opinion', async () => {
        await api.prisma.personalMovieRating.create({
            data: { userId: users[0]!, movieId: movies[0]!, score: 8, source: 'SESSION' },
        });
        const previous = await saved();
        await upload();
        expect((await saved()).find((rating) => rating.movieId === movies[0])).toEqual(previous[0]);
        const changed = csv().replace('Descriptive name,8', 'Descriptive name,4');
        const preview = ratingsCsvResultSchema.parse(
            await (await upload(changed, 'preview')).json(),
        );
        expect(preview.rows[0]).toMatchObject({ action: 'update', currentRating: 8, rating: 4 });
        await upload(changed);
        expect((await saved()).find((rating) => rating.movieId === movies[0])).toMatchObject({
            source: 'PERSONAL',
            score: 4,
        });
        expect(await api.prisma.personalMovieRating.count({ where: { userId: users[1] } })).toBe(0);
        await api.prisma.movie.delete({ where: { id: movies[1] } });
        const result = ratingsCsvResultSchema.parse(
            await (await upload(csv().replace('Descriptive name,8', 'Descriptive name,3'))).json(),
        );
        expect(result.imported).toBe(false);
        expect((await saved())[0]!.score).toBe(4);
    });

    it('should roll back every rating when persistence fails', async () => {
        await withFailingInsert(
            api.prisma,
            'PersonalMovieRating',
            `NEW."movieId" = '${movies[1]}'::uuid`,
            async () => {
                expect((await upload()).status).toBe(500);
                expect(await saved()).toEqual([]);
            },
        );
        expect((await upload()).status).toBe(200);
    });

    it('should reject identity selectors, unauthenticated, unsupported and oversized content', async () => {
        for (const path of [
            '/library/ratings-csv',
            '/library/ratings-csv/preview',
            '/library/ratings-csv/import',
        ]) {
            const method = path.endsWith('csv') ? 'GET' : 'POST';
            expect((await api.request(path, { method })).status).toBe(401);
            expect(
                (await api.request(`${path}?userId=${users[1]}`, { userId: users[0], method }))
                    .status,
            ).toBe(400);
        }
        const unsupported = await api.request('/library/ratings-csv/import', {
            userId: users[0],
            method: 'POST',
            json: { userId: users[1], csv: csv() },
        });
        expect(ratingsCsvResultSchema.parse(await unsupported.json()).imported).toBe(false);
        expect((await upload('x'.repeat(RATINGS_CSV_MAX_BYTES + 1))).status).toBe(413);
        expect(await saved()).toEqual([]);
        const exported = ratingsCsvExportSchema.parse(
            await (await api.request('/library/ratings-csv', { userId: users[1] })).json(),
        );
        expect(exported).toEqual({ csv: `${RATINGS_CSV_HEADER}\r\n`, count: 0 });
    });
});
