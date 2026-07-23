'use server';

import { Resend } from 'resend';

// Initialize Resend with your API Key
const resend = new Resend(process.env.RESEND_API_KEY);

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

  try {
    // 1. Handle Email subscription via Resend
    if (subscribeEmail && email) {
      await resend.emails.send({
        from: 'Acme <onboarding@resend.dev>', // Replace with your verified domain in production
        to: [email],
        subject: 'Welcome to our Newsletter!',
        html: `<p>Thanks for signing up! You will receive updates at <strong>${email}</strong>.</p>`,
      });
    }

    // 2. Handle SMS subscription
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
