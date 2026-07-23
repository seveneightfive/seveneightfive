'use server';

// Sender.net API — https://api.sender.net/
// Auth: Settings → API access tokens → create a token, set SENDER_API_TOKEN
// in your environment (.env.local + Vercel).
const SENDER_API_BASE = 'https://api.sender.net/v2';
const SENDER_API_TOKEN = process.env.SENDER_API_TOKEN as string;

// The group your Weekender broadcast will target.
// Create this once in Sender (Subscribers → Groups → Create a group), then
// set SENDER_GROUP_ID in your environment. You can also fetch group IDs via
// GET https://api.sender.net/v2/groups if you forget it.
const GROUP_ID = process.env.SENDER_GROUP_ID as string;

async function senderFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SENDER_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${SENDER_API_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (data && (data.message?.[0] ?? data.message ?? data.error)) ||
      `Sender API error (${res.status})`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }

  return data;
}

export async function handleSignup(formData: FormData) {
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string;
  const subscribeEmail = formData.get('subscribeEmail') === 'true';
  const subscribeSMS = formData.get('subscribeSMS') === 'true';

  if (!email && subscribeEmail) {
    return { success: false, error: 'Email is required for email updates.' };
  }

  if (!phone && subscribeSMS) {
    return { success: false, error: 'Phone number is required for SMS updates.' };
  }

  if (subscribeEmail && (!SENDER_API_TOKEN || !GROUP_ID)) {
    console.error('SENDER_API_TOKEN or SENDER_GROUP_ID is not set — cannot add subscriber.');
    return { success: false, error: 'Signup is temporarily unavailable. Please try again shortly.' };
  }

  try {
    // 1. Add the contact to the Weekender group in Sender
    //    (Sender upserts on email — if the contact already exists, this
    //    updates them rather than erroring, so no special-casing needed.)
    if (subscribeEmail && email) {
      await senderFetch('/subscribers', {
        method: 'POST',
        body: JSON.stringify({
          email,
          groups: [GROUP_ID],
        }),
      });

      // 2. Send a one-time welcome email confirming the signup.
      // Swap the "from" address for your verified sending domain in Sender
      // (Settings → Domains → Add Domain → verify DNS records) before going
      // live.
      await senderFetch('/message/send', {
        method: 'POST',
        body: JSON.stringify({
          from: { email: 'weekender@seveneightfive.com', name: 'The Weekender' },
          to: { email },
          subject: "You're in! Welcome to The Weekender",
          html: `<p>Thanks for signing up! You'll get The Weekender — Topeka's weekly guide to arts, music, and events — in your inbox every Thursday at <strong>${email}</strong>.</p>`,
        }),
      });
    }

    // 3. Handle SMS subscription
    if (subscribeSMS && phone) {
      // NOTE: Sender's SMS channel is a paid add-on and uses a different
      // flow (subscribers can have a `phone` field, but sending SMS
      // campaigns requires SMS credits on your account). If you want SMS
      // handled here too, add `phone` to the subscriber payload above and
      // wire up Sender's SMS campaign endpoints, or keep a separate
      // provider like Twilio.
      console.log(`Simulating SMS opt-in sent to: ${phone}`);
    }

    return { success: true, message: 'Successfully subscribed!' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Something went wrong.' };
  }
}
