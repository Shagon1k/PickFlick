import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
    invitationDecisionSchema,
    leaveSessionSchema,
    removeSessionParticipantSchema,
    type TInvitationDecision,
} from '@pickflick/contracts';

import { UUID_PARAM, ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { SessionRosterService } from './session-roster.service.js';

@Controller()
export class SessionRosterController {
    constructor(private readonly roster: SessionRosterService) {}

    @Get('sessions/:sessionId/roster')
    get(@CurrentUser() user: IAuthUser, @Param('sessionId', UUID_PARAM) id: string) {
        return this.roster.get(user.id, id);
    }

    @Post('sessions/:sessionId/participation')
    @HttpCode(HttpStatus.OK)
    participate(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', UUID_PARAM) id: string,
        @Body(new ZodValidationPipe(invitationDecisionSchema)) input: TInvitationDecision,
    ) {
        return this.roster.participate(user.id, id, input.decision);
    }

    @Post('sessions/:sessionId/leave')
    @HttpCode(HttpStatus.NO_CONTENT)
    leave(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', UUID_PARAM) id: string,
        @Body(new ZodValidationPipe(leaveSessionSchema)) input: { confirmation: 'LEAVE' },
    ) {
        return this.roster.depart(user.id, id, input);
    }

    @Post('sessions/:sessionId/participants/:participantId/remove')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', UUID_PARAM) id: string,
        @Param('participantId', UUID_PARAM) participantId: string,
        @Body(new ZodValidationPipe(removeSessionParticipantSchema))
        input: { confirmation: 'REMOVE' },
    ) {
        return this.roster.depart(user.id, id, { ...input, participantId });
    }

    @Get('session-invitations/pending')
    listPending(@CurrentUser() user: IAuthUser) {
        return this.roster.listPending(user.id);
    }
}
