import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
    createInvitationSchema,
    invitationDecisionSchema,
    previewInvitationSchema,
    respondInvitationSchema,
    type TCreateInvitation,
    type TInvitationDecision,
    type TRespondInvitation,
} from '@pickflick/contracts';

import { UUID_PARAM, ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { ClubInvitationsService } from './club-invitations.service.js';

@Controller()
export class ClubInvitationsController {
    constructor(private readonly invitations: ClubInvitationsService) {}

    @Post('clubs/:clubId/invitations')
    create(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', UUID_PARAM) clubId: string,
        @Body(new ZodValidationPipe(createInvitationSchema)) input: TCreateInvitation,
    ) {
        return this.invitations.create(user.id, clubId, input);
    }

    @Get('clubs/:clubId/invitations')
    list(@CurrentUser() user: IAuthUser, @Param('clubId', UUID_PARAM) clubId: string) {
        return this.invitations.list(user.id, clubId);
    }

    @Post('clubs/:clubId/invitations/:inviteId/revoke')
    @HttpCode(HttpStatus.NO_CONTENT)
    revoke(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', UUID_PARAM) clubId: string,
        @Param('inviteId', UUID_PARAM) inviteId: string,
    ) {
        return this.invitations.revoke(user.id, clubId, inviteId);
    }

    @Get('club-invitations/pending')
    listPending(@CurrentUser() user: IAuthUser) {
        return this.invitations.listPending(user.id);
    }

    @Post('club-invitations/:inviteId/respond')
    @HttpCode(HttpStatus.OK)
    respondPending(
        @CurrentUser() user: IAuthUser,
        @Param('inviteId', UUID_PARAM) inviteId: string,
        @Body(new ZodValidationPipe(invitationDecisionSchema)) input: TInvitationDecision,
    ) {
        return this.invitations.respondPending(user.id, inviteId, input);
    }

    @Post('club-invitations/preview')
    @HttpCode(HttpStatus.OK)
    preview(
        @CurrentUser() user: IAuthUser,
        @Body(new ZodValidationPipe(previewInvitationSchema))
        input: Pick<TRespondInvitation, 'token'>,
    ) {
        return this.invitations.preview(user.id, input.token);
    }

    @Post('club-invitations/respond')
    @HttpCode(HttpStatus.OK)
    respond(
        @CurrentUser() user: IAuthUser,
        @Body(new ZodValidationPipe(respondInvitationSchema)) input: TRespondInvitation,
    ) {
        return this.invitations.respond(user.id, input);
    }
}
