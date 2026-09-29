import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    Headers,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Put,
    Res,
    StreamableFile,
} from '@nestjs/common';
import {
    changeMemberRoleSchema,
    confirmClubActionSchema,
    createClubSchema,
    type IClubHub,
    type IClubSettings,
    type IClubSummary,
    type TChangeMemberRoleRequest,
    type TConfirmClubActionRequest,
    type TCreateClubRequest,
    type TUpdateClubSettingsRequest,
    updateClubSettingsSchema,
} from '@pickflick/contracts';
import type { Response } from 'express';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ClubAvatarService } from './club-avatar.service.js';
import { ClubLifecycleService } from './club-lifecycle.service.js';
import { ClubsService } from './clubs.service.js';

const clubIdParam = new ParseUUIDPipe({ version: '4' });

const PRIVATE = ['Cache-Control', 'private, no-store'] as const;

@Controller('clubs')
export class ClubsController {
    constructor(
        private readonly clubsService: ClubsService,
        private readonly lifecycleService: ClubLifecycleService,
        private readonly avatarService: ClubAvatarService,
    ) {}

    @Get()
    @Header(...PRIVATE)
    list(@CurrentUser() user: IAuthUser): Promise<IClubSummary[]> {
        return this.clubsService.list(user.id);
    }

    @Get(':clubId/hub')
    @Header(...PRIVATE)
    getHub(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', clubIdParam) clubId: string,
    ): Promise<IClubHub> {
        return this.clubsService.getHub(user.id, clubId);
    }

    @Post()
    create(
        @CurrentUser() user: IAuthUser,
        @Body(new ZodValidationPipe(createClubSchema)) input: TCreateClubRequest,
    ): Promise<IClubSummary> {
        return this.clubsService.create(user.id, input);
    }

    @Get(':clubId/settings')
    @Header(...PRIVATE)
    getSettings(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', clubIdParam) clubId: string,
    ): Promise<IClubSettings> {
        return this.clubsService.getSettings(user.id, clubId);
    }

    @Patch(':clubId/settings')
    updateSettings(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', clubIdParam) clubId: string,
        @Body(new ZodValidationPipe(updateClubSettingsSchema)) input: TUpdateClubSettingsRequest,
    ): Promise<IClubSettings> {
        return this.clubsService.updateSettings(user.id, clubId, input);
    }

    @Patch(':clubId/members/:membershipId/role')
    @HttpCode(HttpStatus.NO_CONTENT)
    changeMemberRole(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', clubIdParam) clubId: string,
        @Param('membershipId', clubIdParam) membershipId: string,
        @Body(new ZodValidationPipe(changeMemberRoleSchema)) input: TChangeMemberRoleRequest,
    ): Promise<void> {
        return this.clubsService.changeMemberRole(user.id, clubId, membershipId, input);
    }

    @Post(':clubId/archive')
    @HttpCode(HttpStatus.NO_CONTENT)
    archive(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', clubIdParam) clubId: string,
        @Body(new ZodValidationPipe(confirmClubActionSchema))
        { confirmation }: TConfirmClubActionRequest,
    ): Promise<void> {
        return this.lifecycleService.archive(user.id, clubId, confirmation);
    }

    @Post(':clubId/reactivate')
    @HttpCode(HttpStatus.NO_CONTENT)
    reactivate(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', clubIdParam) clubId: string,
    ): Promise<void> {
        return this.lifecycleService.reactivate(user.id, clubId);
    }

    @Post(':clubId/leave')
    @HttpCode(HttpStatus.NO_CONTENT)
    leave(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', clubIdParam) clubId: string,
        @Body(new ZodValidationPipe(confirmClubActionSchema))
        { confirmation }: TConfirmClubActionRequest,
    ): Promise<void> {
        return this.lifecycleService.leave(user.id, clubId, confirmation);
    }

    @Post(':clubId/delete')
    @HttpCode(HttpStatus.NO_CONTENT)
    delete(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', clubIdParam) clubId: string,
        @Body(new ZodValidationPipe(confirmClubActionSchema))
        { confirmation }: TConfirmClubActionRequest,
    ): Promise<void> {
        return this.lifecycleService.delete(user.id, clubId, confirmation);
    }

    @Get(':clubId/avatar')
    @Header(...PRIVATE)
    async getAvatar(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', clubIdParam) clubId: string,
        @Res({ passthrough: true }) response: Response,
    ): Promise<StreamableFile> {
        const avatar = await this.avatarService.get(user.id, clubId);
        response.setHeader('Content-Type', avatar.contentType);
        return new StreamableFile(avatar.body);
    }

    @Put(':clubId/avatar')
    @HttpCode(HttpStatus.NO_CONTENT)
    replaceAvatar(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', clubIdParam) clubId: string,
        @Body() body: unknown,
        @Headers('content-type') contentType?: string,
    ): Promise<void> {
        return this.avatarService.replace(user.id, clubId, body, contentType);
    }

    @Delete(':clubId/avatar')
    @HttpCode(HttpStatus.NO_CONTENT)
    removeAvatar(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', clubIdParam) clubId: string,
    ): Promise<void> {
        return this.avatarService.remove(user.id, clubId);
    }
}
