import { Body, Controller, Get, Header, Post, Query, UseFilters } from '@nestjs/common';
import { billingHistoryQuerySchema, type TBillingHistoryQuery } from '@pickflick/contracts';

import { EMPTY_REQUEST, ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { BillingService } from './billing.service.js';
import { BillingCheckoutService } from './billing-checkout.service.js';
import { BillingErrorFilter } from './billing-error.filter.js';

@Controller('billing')
@UseFilters(BillingErrorFilter)
export class BillingController {
    constructor(
        private readonly billing: BillingService,
        private readonly checkout: BillingCheckoutService,
    ) {}

    @Public()
    @Get('offer')
    @Header('Cache-Control', 'no-store')
    getOffer() {
        return this.billing.getOffer();
    }

    @Get()
    @Header('Cache-Control', 'private, no-store')
    get(@Query(EMPTY_REQUEST) query: Record<string, never>, @CurrentUser() user: IAuthUser) {
        return this.billing.get(user.id);
    }

    @Get('invoices')
    @Header('Cache-Control', 'private, no-store')
    listInvoices(
        @CurrentUser() user: IAuthUser,
        @Query(new ZodValidationPipe(billingHistoryQuerySchema)) query: TBillingHistoryQuery,
    ) {
        return this.billing.listInvoices(user.id, query.cursor);
    }

    @Post('checkout')
    @Header('Cache-Control', 'private, no-store')
    createCheckout(
        @Query(EMPTY_REQUEST) query: Record<string, never>,
        @Body(EMPTY_REQUEST) body: Record<string, never>,
        @CurrentUser() user: IAuthUser,
    ) {
        return this.checkout.create(user.id);
    }

    @Post('portal')
    @Header('Cache-Control', 'private, no-store')
    createPortal(
        @Query(EMPTY_REQUEST) query: Record<string, never>,
        @Body(EMPTY_REQUEST) body: Record<string, never>,
        @CurrentUser() user: IAuthUser,
    ) {
        return this.billing.createPortal(user.id);
    }
}
