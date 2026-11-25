'use client';

import type { IBillingHistory } from '@pickflick/contracts';
import { useEffect, useState, useTransition } from 'react';

import Alert from '#components/ui/Alert/Alert';
import Button from '#components/ui/Button/Button';
import HorizontalScroll from '#components/ui/HorizontalScroll/HorizontalScroll';
import { getOfflineMessage } from '#lib/offline';

import { readBillingHistory } from '../../billing-actions';
import styles from './SubscriptionPanel.module.scss';

const HISTORY_COLUMNS = 4;
const DECIMAL_BASE = 10;

function formatMoney(amount: number, currency: string) {
    const formatter = new Intl.NumberFormat('en', { style: 'currency', currency });
    const minorUnits = DECIMAL_BASE ** (formatter.resolvedOptions().maximumFractionDigits ?? 2);
    return formatter.format(amount / minorUnits);
}

function getEmptyLabel({
    isPending,
    message,
    isEnabled,
    hasCustomer,
    hasHistory,
}: {
    isPending: boolean;
    message: string;
    isEnabled: boolean;
    hasCustomer: boolean;
    hasHistory: boolean;
}) {
    if (isPending || (isEnabled && hasCustomer && !hasHistory && !message))
        return 'Loading billing history…';
    if (message) return 'Billing history unavailable';
    return isEnabled
        ? 'No billing history'
        : 'Billing history unavailable while billing is disabled';
}

export default function BillingHistory({
    isEnabled,
    hasCustomer,
}: {
    isEnabled: boolean;
    hasCustomer: boolean;
}) {
    const [history, setHistory] = useState<IBillingHistory | null>(null);
    const [message, setMessage] = useState('');
    const [isPending, startTransition] = useTransition();
    useEffect(() => {
        if (!isEnabled || !hasCustomer) return;
        let isCurrent = true;
        startTransition(async () => {
            try {
                const result = await readBillingHistory(undefined);
                if (!isCurrent) return;
                if (result.ok) setHistory(result.data);
                else setMessage(result.message);
            } catch {
                if (isCurrent) setMessage('Billing history could not be loaded. Try again.');
            }
        });
        return () => {
            isCurrent = false;
        };
    }, [isEnabled, hasCustomer]);
    function handleLoadMore() {
        const offline = getOfflineMessage();
        if (offline) return setMessage(offline);
        setMessage('');
        startTransition(async () => {
            try {
                const result = await readBillingHistory(history?.nextCursor ?? undefined);
                if (!result.ok) return setMessage(result.message);
                setHistory((previous) => ({
                    ...result.data,
                    invoices: [...(previous?.invoices ?? []), ...result.data.invoices],
                }));
            } catch {
                setMessage('Billing history could not be loaded. Try again.');
            }
        });
    }
    return (
        <section aria-labelledby="billing-history-title" className={styles.card}>
            <h2 id="billing-history-title">Billing history</h2>
            {message ? <Alert tone="danger">{message}</Alert> : null}
            <HorizontalScroll label="Billing history" variant="plain">
                <table className={styles.history}>
                    <caption className="visually-hidden">
                        Provider invoices, including applicable tax
                    </caption>
                    <thead>
                        <tr>
                            <th scope="col">Date</th>
                            <th scope="col">Description</th>
                            <th scope="col">Amount</th>
                            <th scope="col">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history?.invoices.length ? (
                            history.invoices.map((invoice) => (
                                <tr key={invoice.id}>
                                    <td>
                                        {new Intl.DateTimeFormat('en', {
                                            dateStyle: 'medium',
                                            timeZone: 'UTC',
                                        }).format(new Date(invoice.createdAt))}
                                    </td>
                                    <td>
                                        {invoice.documentUrl ? (
                                            <a
                                                href={invoice.documentUrl}
                                                rel="noopener noreferrer"
                                                target="_blank"
                                            >
                                                Pro monthly invoice
                                            </a>
                                        ) : (
                                            'Pro monthly invoice'
                                        )}
                                    </td>
                                    <td>{formatMoney(invoice.amount, invoice.currency)}</td>
                                    <td>{invoice.status ?? 'Unavailable'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={HISTORY_COLUMNS}>
                                    {getEmptyLabel({
                                        isPending,
                                        message,
                                        isEnabled,
                                        hasCustomer,
                                        hasHistory: history !== null,
                                    })}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </HorizontalScroll>
            {isEnabled && hasCustomer && (history?.nextCursor || message) ? (
                <div>
                    <Button loading={isPending} onClick={handleLoadMore} variant="secondary">
                        {message ? 'Retry billing history' : 'Load more invoices'}
                    </Button>
                </div>
            ) : null}
        </section>
    );
}
