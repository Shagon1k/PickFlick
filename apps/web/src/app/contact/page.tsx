import { BrandImage } from "@pickflick/ui";

import { ContactForm } from "../../components/contact/contact-form";
import styles from "../../components/contact/contact.module.css";
import { PublicShell } from "../../components/shells/shells";
import { createPublicMetadata } from "../../public-metadata";

export const metadata = createPublicMetadata({
  title: "Contact Us — PickFlick",
  description: "Send PickFlick a concise message or write to the public contact address.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <PublicShell currentPage="contact">
      <section aria-labelledby="contact-title" className={styles.scene}>
        <div className={styles.sceneInner}>
          <BrandImage alt="" asset="reviewsCritique" className={styles.mascot} loading="eager" />
          <div className={styles.card}>
            <h1 id="contact-title">Contact Us</h1>
            <p className={styles.lead}>Report a bug, leave feedback, share an idea, or just say hello.</p>
            <ContactForm />
            <p className={styles.emailAlternative}>
              Prefer email? Write to {" "}
              <a href="mailto:hello@pick-flick.app">hello@pick-flick.app</a>
            </p>
          </div>
          <div aria-hidden="true" className={styles.divider}><i /><i /><i /></div>
          <p className={styles.ornament}>Scene 05 · Share post-watch review</p>
        </div>
      </section>
    </PublicShell>
  );
}
