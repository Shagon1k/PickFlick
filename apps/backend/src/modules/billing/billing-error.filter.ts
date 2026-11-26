import {
    type ArgumentsHost,
    Catch,
    type ExceptionFilter,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';

import { ApiExceptionFilter } from '../../common/filters/api-exception.filter.js';
import { BillingProviderError } from './billing.types.js';

@Catch(BillingProviderError)
export class BillingErrorFilter implements ExceptionFilter<BillingProviderError> {
    catch(error: BillingProviderError, host: ArgumentsHost) {
        const exception =
            error.reason === 'BILLING_RESOURCE_MISSING'
                ? new NotFoundException({ reason: error.reason })
                : new ServiceUnavailableException({ reason: error.reason });
        new ApiExceptionFilter().catch(exception, host);
    }
}
