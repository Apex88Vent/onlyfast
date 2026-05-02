import React, { useEffect, useRef } from 'react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms';
}

const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, type }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      closeRef.current?.focus();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
        // Focus trap
        if (e.key === 'Tab' && modalRef.current) {
          const focusable = modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col border border-[#E5E7EB]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#F5F5F7] rounded-t-2xl">
          <h2 id="legal-modal-title" className="text-lg font-bold text-[#1A1B23]">
            {type === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#1A1B23] hover:bg-[#E5E7EB] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 text-sm text-[#4B5563] leading-relaxed space-y-4">
          {type === 'privacy' ? (
            <>
              <p className="text-xs text-[#9CA3AF]">Last updated: April 7, 2026</p>
              <h3 className="text-base font-bold text-[#1A1B23]">1. Information We Collect</h3>
              <p>OnlyFast collects the following information when you create an account: email address, password (encrypted), and selected subscription plan. When you use the app, we store your chassis setup data, track information, and session notes.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">2. How We Use Your Information</h3>
              <p>Your data is used solely to provide the OnlyFast setup tracking service. We use your email for account authentication and important service communications. Setup data is used to provide AI-powered suggestions and setup comparison features.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">3. Data Storage & Security</h3>
              <p>Your data is stored securely using Supabase infrastructure with row-level security. Passwords are hashed and never stored in plain text. We do not sell, share, or transfer your personal data to third parties.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">4. Cookies</h3>
              <p>We use only essential cookies required for authentication and session management. We do not use tracking, analytics, or advertising cookies.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">5. Your Rights</h3>
              <p>You have the right to access, correct, or delete your personal data at any time. You can delete your account and all associated data by contacting support. You can export your setup data from the Saved Setups section.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">6. Data Retention</h3>
              <p>Your data is retained as long as your account is active. If you delete your account, all personal data and setup records will be permanently removed within 30 days.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">7. Children's Privacy</h3>
              <p>OnlyFast is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from minors.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">8. Changes to This Policy</h3>
              <p>We may update this privacy policy from time to time. We will notify you of any material changes via email or in-app notification.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">9. Contact</h3>
              <p>For privacy-related questions or data requests, please contact us at privacy@onlyfast.com.</p>
            </>
          ) : (
            <>
              <p className="text-xs text-[#9CA3AF]">Last updated: April 7, 2026</p>
              <h3 className="text-base font-bold text-[#1A1B23]">1. Acceptance of Terms</h3>
              <p>By accessing or using OnlyFast, you agree to be bound by these Terms of Service. If you do not agree, do not use the service.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">2. Service Description</h3>
              <p>OnlyFast is a chassis setup tracking and AI suggestion tool for dirt track racing. The service provides setup storage, comparison, and AI-powered recommendations.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">3. Assumption of Risk & Liability Waiver</h3>
              <p className="font-semibold text-red-700">MOTORSPORT RACING IS INHERENTLY DANGEROUS AND CAN RESULT IN SERIOUS INJURY OR DEATH. OnlyFast is a setup tracking tool ONLY. All suggestions and recommendations are for informational purposes only. OnlyFast, its owners, developers, and affiliates assume NO responsibility for any injuries, damages, or death resulting from racing activities. The use of this tool in NO WAY guarantees driver safety.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">4. Account Plans</h3>
              <p><strong>Free Plan:</strong> Up to 3 saved setups. Setups lock after 24 hours. You may delete old setups to make room for new ones.</p>
              <p><strong>Premium Plan ($5/month):</strong> Unlimited saved setups. No 24-hour lock. Team sharing capabilities.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">5. User Conduct</h3>
              <p>You agree not to use OnlyFast for any unlawful purpose, to share harmful or abusive content through team sharing features, or to attempt to gain unauthorized access to other users' data.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">6. Content Moderation</h3>
              <p>OnlyFast reserves the right to review, flag, or remove any user-generated content (including shared setups and notes) that violates these terms or contains illegal, abusive, fraudulent, explicit, or harmful material.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">7. Intellectual Property</h3>
              <p>Your setup data belongs to you. OnlyFast retains the right to use anonymized, aggregated data for service improvement purposes only.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">8. Termination</h3>
              <p>We reserve the right to suspend or terminate accounts that violate these terms. You may cancel your account at any time.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">9. Limitation of Liability</h3>
              <p>OnlyFast is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service.</p>
              <h3 className="text-base font-bold text-[#1A1B23]">10. Contact</h3>
              <p>For questions about these terms, contact us at legal@onlyfast.com.</p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full bg-[#00A8E8] hover:bg-[#0090c7] text-white py-2.5 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;
