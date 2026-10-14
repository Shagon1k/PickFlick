'use client';

import { useId, useState } from 'react';

import styles from '#app/(marketing)/marketing.module.scss';
import { pricingFaqs } from '#app/(marketing)/marketing-content';

export default function PricingFaq() {
    const instanceId = useId();
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <div className={styles.faqList}>
            {pricingFaqs.map((faq, index) => {
                const isOpen = index === openIndex;
                const buttonId = `${instanceId}-question-${index}`;
                const panelId = `${instanceId}-answer-${index}`;

                return (
                    <div className={styles.faqItem} key={faq.question}>
                        <h3>
                            <button
                                aria-controls={panelId}
                                aria-expanded={isOpen}
                                className={styles.faqQuestion}
                                id={buttonId}
                                onClick={() => setOpenIndex(isOpen ? -1 : index)}
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
                            hidden={!isOpen}
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
