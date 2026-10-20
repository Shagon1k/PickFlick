import {
    Body,
    Controller,
    Get,
    Header,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Post,
} from '@nestjs/common';
import {
    createSessionInvitationSchema,
    invitationDecisionSchema,
    leaveSessionSchema,
    previewInvitationSchema,
    removeSessionParticipantSchema,
    respondInvitationSchema,
    type TCreateSessionInvitation,
    type TInvitationDecision,
    type TRespondInvitation,
} from '@pickflick/contracts';

import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { SessionRosterService } from './session-roster.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });
@Controller()
export class SessionRosterController {
    constructor(private readonly roster: SessionRosterService) {}

    @Get('sessions/:sessionId/roster')
    @Header('Cache-Control', 'private, no-store')
    get(@CurrentUser() user: IAuthUser, @Param('sessionId', uuid) id: string) {
        return this.roster.get(user.id, id);
    }

    @Post('sessions/:sessionId/participation')
    @Header('Cache-Control', 'private, no-store')
    @HttpCode(HttpStatus.OK)
    participate(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', uuid) id: string,
        @Body(new ZodValidationPipe(invitationDecisionSchema)) input: TInvitationDecision,
    ) {
        return this.roster.participate(user.id, id, input.decision);
    }

    @Post('sessions/:sessionId/invitations')
    @Header('Cache-Control', 'private, no-store')
    create(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', uuid) id: string,
        @Body(new ZodValidationPipe(createSessionInvitationSchema)) input: TCreateSessionInvitation,
    ) {
        return this.roster.create(user.id, id, input.membershipId);
    }

    @Post('sessions/:sessionId/invitations/:inviteId/revoke')
    @Header('Cache-Control', 'private, no-store')
    @HttpCode(HttpStatus.NO_CONTENT)
    revoke(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', uuid) id: string,
        @Param('inviteId', uuid) inviteId: string,
    ) {
        return this.roster.revoke(user.id, id, inviteId);
    }

    @Post('sessions/:sessionId/leave')
    @Header('Cache-Control', 'private, no-store')
    @HttpCode(HttpStatus.NO_CONTENT)
    leave(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', uuid) id: string,
        @Body(new ZodValidationPipe(leaveSessionSchema)) input: { confirmation: 'LEAVE' },
    ) {
        return this.roster.depart(user.id, id, input);
    }

    @Post('sessions/:sessionId/participants/:participantId/remove')
    @Header('Cache-Control', 'private, no-store')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', uuid) id: string,
        @Param('participantId', uuid) participantId: string,
        @Body(new ZodValidationPipe(removeSessionParticipantSchema))
        input: { confirmation: 'REMOVE' },
    ) {
        return this.roster.depart(user.id, id, { ...input, participantId });
    }

    @Get('session-invitations/pending')
    @Header('Cache-Control', 'private, no-store')
    listPending(@CurrentUser() user: IAuthUser) {
        return this.roster.listPending(user.id);
    }

    @Post('session-invitations/preview')
    @Header('Cache-Control', 'private, no-store')
    @HttpCode(HttpStatus.OK)
    preview(
        @CurrentUser() user: IAuthUser,
        @Body(new ZodValidationPipe(previewInvitationSchema))
        input: Pick<TRespondInvitation, 'token'>,
    ) {
        return this.roster.preview(user.id, input.token);
    }

    @Post('session-invitations/respond')
    @Header('Cache-Control', 'private, no-store')
    @HttpCode(HttpStatus.OK)
    respond(
        @CurrentUser() user: IAuthUser,
        @Body(new ZodValidationPipe(respondInvitationSchema)) input: TRespondInvitation,
    ) {
        return this.roster.respond(user.id, { token: input.token }, input.decision);
    }

    @Post('session-invitations/:inviteId/respond')
    @Header('Cache-Control', 'private, no-store')
    @HttpCode(HttpStatus.OK)
    respondPending(
        @CurrentUser() user: IAuthUser,
        @Param('inviteId', uuid) id: string,
        @Body(new ZodValidationPipe(invitationDecisionSchema)) input: TInvitationDecision,
    ) {
        return this.roster.respond(user.id, { id }, input.decision);
    }
}
