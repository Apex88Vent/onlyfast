import React, { useState, useEffect, useRef } from 'react';

const CookieConsent: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const consent = localStorage.getItem('onlyfast_cookie_consent');
    if (!consent) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (visible && bannerRef.current) {
      const focusable = bannerRef.current.querySelector('button');
      focusable?.focus();
    }
  }, [visible]);

  const handleAccept = () => {
    localStorage.setItem('onlyfast_cookie_consent', 'accepted');
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('onlyfast_cookie_consent', 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="cookie-desc"
      className="fixed bottom-0 left-0 right-0 z-[150] bg-white border-t-2 border-[#E5E7EB] shadow-2xl p-4 sm:p-6"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="text-sm font-bold text-[#1A1B23] mb-1">Cookie & Privacy Notice</h2>
          <p id="cookie-desc" className="text-xs text-[#6B7280] leading-relaxed">
            OnlyFast uses essential cookies for authentication and saving your preferences. 
            We do not use tracking or advertising cookies. Your setup data is stored securely 
            and is only accessible to you. By continuing, you agree to our use of essential cookies.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Both buttons are equally prominent - no dark patterns */}
          <button
            onClick={handleDecline}
            className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#4B5563] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
          >
            Decline Optional
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 bg-[#00A8E8] hover:bg-[#0090c7] text-white rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
          >
            Accept Essential
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
