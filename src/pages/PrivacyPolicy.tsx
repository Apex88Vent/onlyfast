import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const LOGO_URL = 'https://d64gsuwffb70l.cloudfront.net/688263e7085fd34dcdf7f46a_1775752881652_48fe46d9.png';

const PrivacyPolicy: React.FC = () => {
  useEffect(() => {
    document.title = 'Privacy Policy | OnlyFast';
  }, []);

  return (
    <main className="min-h-screen bg-[#F5F5F7] px-4 py-8 sm:py-12">
      <article className="mx-auto max-w-3xl rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-8">
        <header className="mb-6 border-b border-[#E5E7EB] pb-5">
          <Link to="/" className="inline-flex items-center">
            <img src={LOGO_URL} alt="OnlyFast" className="h-12 w-auto" />
          </Link>
          <h1 className="mt-5 text-3xl font-bold text-[#1A1B23]">Privacy Policy</h1>
          <p className="mt-2 text-sm text-[#9CA3AF]">Last updated: April 7, 2026</p>
        </header>

        <div className="space-y-5 text-sm leading-relaxed text-[#4B5563]">
          <section>
            <h2 className="text-base font-bold text-[#1A1B23]">1. Information We Collect</h2>
            <p className="mt-2">
              OnlyFast collects the following information when you create an account: email address,
              password (encrypted), and selected subscription plan. When you use the app, we store
              your chassis setup data, track information, and session notes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1A1B23]">2. How We Use Your Information</h2>
            <p className="mt-2">
              Your data is used solely to provide the OnlyFast setup tracking service. We use your
              email for account authentication and important service communications. Setup data is
              used to provide AI-powered suggestions and setup comparison features.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1A1B23]">3. Data Storage & Security</h2>
            <p className="mt-2">
              Your data is stored securely using Supabase infrastructure with row-level security.
              Passwords are hashed and never stored in plain text. We do not sell, share, or transfer
              your personal data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1A1B23]">4. Cookies</h2>
            <p className="mt-2">
              We use only essential cookies required for authentication and session management. We do
              not use tracking, analytics, or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1A1B23]">5. Your Rights</h2>
            <p className="mt-2">
              You have the right to access, correct, or delete your personal data at any time. You can
              delete your account and all associated data by contacting support. You can export your
              setup data from the Saved Setups section.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1A1B23]">6. Data Retention</h2>
            <p className="mt-2">
              Your data is retained as long as your account is active. If you delete your account, all
              personal data and setup records will be permanently removed within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1A1B23]">7. Children's Privacy</h2>
            <p className="mt-2">
              OnlyFast is not intended for use by individuals under the age of 18. We do not knowingly
              collect personal information from minors.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1A1B23]">8. Changes to This Policy</h2>
            <p className="mt-2">
              We may update this privacy policy from time to time. We will notify you of any material
              changes via email or in-app notification.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1A1B23]">9. Contact</h2>
            <p className="mt-2">
              For privacy-related questions, data requests, or account deletion requests, please
              contact us at{' '}
              <a
                href="mailto:admin@onlyfast.app"
                className="font-semibold text-[#00A8E8] underline-offset-2 hover:underline"
              >
                admin@onlyfast.app
              </a>
              .
            </p>
          </section>
        </div>

        <footer className="mt-8 border-t border-[#E5E7EB] pt-5">
          <Link
            to="/"
            className="text-sm font-semibold text-[#00A8E8] underline-offset-2 hover:underline"
          >
            Back to OnlyFast
          </Link>
        </footer>
      </article>
    </main>
  );
};

export default PrivacyPolicy;
