'use client';

import { useState } from 'react';
import { handleSignup } from '../actions/signup';

export default function SignupForm() {
  const [emailSub, setEmailSub] = useState(true);
  const [smsSub, setSmsSub] = useState(false);
  const [status, setStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function clientAction(formData: FormData) {
    setLoading(true);
    setStatus(null);
    
    // Append the current state of checkboxes explicitly to form data
    formData.append('subscribeEmail', String(emailSub));
    formData.append('subscribeSMS', String(smsSub));

    const result = await handleSignup(formData);
    
    setLoading(false);
    if (result.success) {
      setStatus({ success: true, message: result.message });
    } else {
      setStatus({ success: false, message: result.error });
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-md border border-gray-100">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Stay Updated</h2>
      
      <form action={clientAction} className="space-y-4">
        {/* Channel Toggles */}
        <div className="flex gap-4 mb-4">
          <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
            <input 
              type="checkbox" 
              checked={emailSub} 
              onChange={(e) => setEmailSub(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Email Updates</span>
          </label>
          <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
            <input 
              type="checkbox" 
              checked={smsSub} 
              onChange={(e) => setSmsSub(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>SMS Alerts</span>
          </label>
        </div>

        {/* Dynamic Email Input */}
        {emailSub && (
          <div className="flex flex-col space-y-1">
            <label htmlFor="email" className="text-xs font-semibold text-gray-600">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              required={emailSub}
              placeholder="you@example.com"
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Dynamic Phone Input */}
        {smsSub && (
          <div className="flex flex-col space-y-1">
            <label htmlFor="phone" className="text-xs font-semibold text-gray-600">Phone Number</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              required={smsSub}
              placeholder="+1 (555) 000-0000"
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || (!emailSub && !smsSub)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md text-sm transition-colors disabled:bg-gray-400"
        >
          {loading ? 'Subscribing...' : 'Subscribe Now'}
        </button>
      </form>

      {/* Dynamic Feedback UI */}
      {status && (
        <div className={`mt-4 p-3 rounded-md text-sm ${status.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}
