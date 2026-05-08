import { createClient } from '@supabase/supabase-js'

const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_ANON_KEY')

async function sendOtp(phoneNumber) {
  const { data, error } = await supabase.auth.signInWithOtp({
    phone: phoneNumber,
  })
  
  if (error) console.error('Error sending OTP:', error.message)
  else console.log('OTP sent to:', phoneNumber)
}

async function verifyOtp(phoneNumber, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone: phoneNumber,
    token: token,
    type: 'sms',
  })

  if (error) {
    console.error('Verification failed:', error.message)
  } else {
    console.log('User logged in:', data.user)
    // The user session is now active
  }
}
