'use client';

import { useId, useState } from 'react';

import { pricingFaqs } from '@/app/(marketing)/marketing-content';
import styles from '@/app/(marketing)/marketing.module.scss';

export function PricingFaq() {
    const instanceId = useId();
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <div className={styles.faqList}>
            {pricingFaqs.map((faq, index) => {
                const open = index === openIndex;
                const buttonId = `${instanceId}-question-${index}`;
                const panelId = `${instanceId}-answer-${index}`;

                return (
                    <div className={styles.faqItem} key={faq.question}>
                        <h3>
                            <button
                                aria-controls={panelId}
                                aria-expanded={open}
                                className={styles.faqQuestion}
                                id={buttonId}
                                onClick={() => setOpenIndex(open ? -1 : index)}
                                type="button"
                            >
                                <span className={styles.faqNumber}>
                                    {String(index + 1).padStart(2, '0')}
                                </span>
                                <span>{faq.question}</span>
                                <span aria-hidden="true" className={styles.faqCue}>
                                    →
                                </span>
                            </button>
                        </h3>
                        <div
                            aria-labelledby={buttonId}
                            className={styles.faqPanel}
                            hidden={!open}
                            id={panelId}
                            role="region"
                        >
                            <p>{faq.answer}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
