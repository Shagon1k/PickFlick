import {
    Body,
    Controller,
    Get,
    Header,
    HttpCode,
    Param,
    ParseUUIDPipe,
    Post,
} from '@nestjs/common';
import {
    createInvitationSchema,
    invitationDecisionSchema,
    previewInvitationSchema,
    respondInvitationSchema,
    type TCreateInvitation,
    type TInvitationDecision,
    type TRespondInvitation,
} from '@pickflick/contracts';

import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { ClubInvitationsService } from './club-invitations.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller()
export class ClubInvitationsController {
    constructor(private readonly invitations: ClubInvitationsService) {}

    @Post('clubs/:clubId/invitations')
    @Header('Cache-Control', 'private, no-store')
    create(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', uuid) clubId: string,
        @Body(new ZodValidationPipe(createInvitationSchema)) input: TCreateInvitation,
    ) {
        return this.invitations.create(user.id, clubId, input);
    }

    @Get('clubs/:clubId/invitations')
    @Header('Cache-Control', 'private, no-store')
    list(@CurrentUser() user: IAuthUser, @Param('clubId', uuid) clubId: string) {
        return this.invitations.list(user.id, clubId);
    }

    @Post('clubs/:clubId/invitations/:inviteId/revoke')
    @HttpCode(204)
    revoke(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', uuid) clubId: string,
        @Param('inviteId', uuid) inviteId: string,
    ) {
        return this.invitations.revoke(user.id, clubId, inviteId);
    }

    @Get('club-invitations/pending')
    @Header('Cache-Control', 'private, no-store')
    pending(@CurrentUser() user: IAuthUser) {
        return this.invitations.pending(user.id);
    }

    @Post('club-invitations/:inviteId/respond')
    @HttpCode(200)
    @Header('Cache-Control', 'private, no-store')
    respondPending(
        @CurrentUser() user: IAuthUser,
        @Param('inviteId', uuid) inviteId: string,
        @Body(new ZodValidationPipe(invitationDecisionSchema)) input: TInvitationDecision,
    ) {
        return this.invitations.respondPending(user.id, inviteId, input);
    }

    @Post('club-invitations/preview')
    @HttpCode(200)
    @Header('Cache-Control', 'private, no-store')
    preview(
        @CurrentUser() user: IAuthUser,
        @Body(new ZodValidationPipe(previewInvitationSchema))
        input: Pick<TRespondInvitation, 'token'>,
    ) {
        return this.invitations.preview(user.id, input.token);
    }

    @Post('club-invitations/respond')
    @HttpCode(200)
    @Header('Cache-Control', 'private, no-store')
    respond(
        @CurrentUser() user: IAuthUser,
        @Body(new ZodValidationPipe(respondInvitationSchema)) input: TRespondInvitation,
    ) {
        return this.invitations.respond(user.id, input);
    }
}
