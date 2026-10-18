import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import TermsOfServiceContent from '@/components/TermsOfServiceContent';

export default function TermsOfService() {
  useEffect(() => { document.title = 'Terms of Service | OnlyFast'; }, []);
  return <main className="min-h-screen bg-[#F5F5F7] px-4 py-8 sm:py-12">
    <article className="mx-auto max-w-3xl rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-8">
      <header className="mb-6 border-b border-[#E5E7EB] pb-5">
        <Link to="/" className="inline-flex items-center">
          <img src="/onlyfast-logo.png" alt="OnlyFast" className="h-12 w-auto" />
        </Link>
        <h1 className="mt-5 text-3xl font-bold text-[#1A1B23]">Terms of Service</h1>
      </header>
      <section aria-labelledby="terms-agreement" className="space-y-4 text-sm leading-relaxed text-[#4B5563]">
        <h2 id="terms-agreement" className="sr-only">OnlyFast agreement</h2>
        <TermsOfServiceContent />
      </section>
      <footer className="mt-8 border-t border-[#E5E7EB] pt-5">
        <Link to="/" className="text-sm font-semibold text-[#00A8E8] underline-offset-2 hover:underline">Back to OnlyFast</Link>
      </footer>
    </article>
  </main>;
}
