import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const LOGO_URL = '/onlyfast-logo.png';

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
          <p className="mt-2 text-sm text-[#9CA3AF]">Last updated: October 29, 2026</p>
        </header>

        <div className="space-y-5 text-sm leading-relaxed text-[#4B5563]">
          <section>
            <h2 className="text-base font-bold text-[#1A1B23]">1. Information We Collect</h2>
            <p className="mt-2">
              OnlyFast uses your email address and account identifier to authenticate your account.
              Supabase Auth securely processes your password; passwords are hashed, not stored in plain text.
              We store your membership status, chassis setup data, track information, session notes,
              and timing results. Images you select for timing scans are processed to extract timing data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1A1B23]">2. How We Use Your Information</h2>
            <p className="mt-2">
              Your setup data is used to provide the OnlyFast setup tracking service. We use your
              email for account authentication and important service communications. Setup data is
              used to provide AI-powered suggestions and setup comparison features.
              When you request Setup Assist, the relevant setup information and driver feedback are
              sent through our server to OpenAI for processing. Timing images you submit for scanning
              are also sent through our server to OpenAI to read the results.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1A1B23]">3. Data Storage & Security</h2>
            <p className="mt-2">
              Your data is stored securely using Supabase infrastructure with row-level security.
              Passwords are hashed and never stored in plain text. Service providers process data
              needed to operate OnlyFast. Google AdMob may process advertising-related device and
              interaction data in the Android and iOS apps as described below.
              Native Apple and Google subscriptions are processed by the applicable store and RevenueCat.
              RevenueCat processes the OnlyFast account identifier, purchase and receipt information,
              subscription status and related transaction information so our server can verify membership.
              Website payments continue to use Stripe. OnlyFast does not receive your full payment-card details.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1A1B23]">4. Cookies & Advertising</h2>
            <p className="mt-2">
              We use essential cookies for authentication and session management. The Android and iOS apps may
              display Google AdMob ads to eligible signed-in Rookie accounts. Pro and Teams do not display advertisements.
              AdMob may process device identifiers, IP addresses, device information, and ad interactions
              for ad delivery, measurement, diagnostics and fraud prevention. Ad display settings do not
              necessarily stop an SDK included in the native app from initializing or making requests.
              Required advertising privacy choices must be collected separately; accepting essential
              cookies does not authorize personalized advertising. On iOS, tracking permission is requested separately through Apple's native prompt. Tracking denial does not grant permission to track or personalize ads.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#1A1B23]">5. Your Rights</h2>
            <p className="mt-2">
              You have the right to access, correct, or delete your personal data at any time. You can
              delete your account through Account Settings or contact support for assistance. Setup
              exports are available from Saved Setups with an eligible membership. Deleting your
              OnlyFast account does not cancel an Apple, Google or Stripe subscription; manage cancellation
              through the provider where you subscribed.
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
