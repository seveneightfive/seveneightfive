'use client';

import { useState } from 'react';
import { handleSignup } from '../actions/signup';
import styles from './SignupForm.module.css';

export default function SignupForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function clientAction(formData: FormData) {
    setLoading(true);
    setStatus(null);

    // This footer form is email-only — keep the shape handleSignup expects.
    formData.append('subscribeEmail', 'true');
    formData.append('subscribeSMS', 'false');

    const result = await handleSignup(formData);

    setLoading(false);
    if (result.success) {
      setStatus({ success: true, message: result.message });
      setEmail('');
    } else {
      setStatus({ success: false, message: result.error });
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <h2 className={styles.headline}>
          Most Emails Suck. <em>Ours Don&rsquo;t.</em>
        </h2>
        <p className={styles.sub}>
          Get the 785 Weekender and stay in the know of upcoming events.
        </p>

        <form action={clientAction} className={styles.form}>
          <input
            type="email"
            name="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email here..."
            className={styles.input}
          />
          <button type="submit" disabled={loading} className={styles.btn}>
            {loading ? '…' : 'Go'}
          </button>
        </form>

        {status && (
          <div
            className={`${styles.status} ${
              status.success ? styles.statusSuccess : styles.statusError
            }`}
          >
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}
