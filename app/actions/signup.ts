'use server';

import { Resend } from 'resend';

// Initialize Resend with your API Key
const resend = new Resend(process.env.RESEND_API_KEY);

// The Audience your Weekender broadcast will target.
// Create this once in the Resend dashboard (Audiences → Create), then
// set RESEND_AUDIENCE_ID in your environment (.env.local + Vercel).
const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID as string;

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

  if (subscribeEmail && !AUDIENCE_ID) {
    // Fail loudly in dev rather than silently losing signups because the
    // env var was never set.
    console.error('RESEND_AUDIENCE_ID is not set — cannot add contact to an audience.');
    return { success: false, error: 'Signup is temporarily unavailable. Please try again shortly.' };
  }

  try {
    // 1. Add the contact to the Weekender Audience in Resend
    if (subscribeEmail && email) {
      const { error: contactError } = await resend.contacts.create({
        email,
        audienceId: AUDIENCE_ID,
        unsubscribed: false,
      });

      // Resend returns an error if the contact already exists — treat that
      // as a success rather than surfacing it to the person signing up.
      if (contactError && !/already exists/i.test(contactError.message ?? '')) {
        return { success: false, error: contactError.message || 'Could not save your subscription.' };
      }

      // 2. Send a one-time welcome email confirming the signup.
      // Swap the "from" address for your verified sending domain in Resend
      // (Domains → Add Domain → verify DNS records) before going live —
      // onboarding@resend.dev only works for testing.
      await resend.emails.send({
        from: 'The Weekender <weekender@seveneightfive.com>',
        to: [email],
        subject: "You're in! Welcome to The Weekender",
        html: `<p>Thanks for signing up! You'll get The Weekender — Topeka's weekly guide to arts, music, and events — in your inbox every Thursday at <strong>${email}</strong>.</p>`,
      });
    }

    // 3. Handle SMS subscription
    if (subscribeSMS && phone) {
      // NOTE: Resend does not support native SMS.
      // Integrate your chosen SMS gateway SDK here (e.g., Twilio, Plivo):
      // await smsClient.messages.create({ body: 'Welcome!', to: phone, from: '...' });
      console.log(`Simulating SMS opt-in sent to: ${phone}`);
    }

    return { success: true, message: 'Successfully subscribed!' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Something went wrong.' };
  }
}
