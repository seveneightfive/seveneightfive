import { createClient } from '@supabase/supabase-js'

const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_ANON_KEY')

async function sendOtp(phoneNumber) {
  const { data, error } = await supabase.auth.signInWithOtp({
    phone: phoneNumber,
  })
  
  if (error) console.error('Error sending OTP:', error.message)
  else console.log('OTP sent to:', phoneNumber)
}
