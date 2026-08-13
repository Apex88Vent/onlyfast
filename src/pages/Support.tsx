import React, { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircleQuestion } from 'lucide-react';

const LOGO_URL = '/onlyfast-logo.png';
const SUPPORT_EMAIL = 'admin@onlyfast.app';

const SUPPORT_TOPICS = [
  'Account help',
  'Billing or subscription',
  'Technical issue',
  'Privacy or data request',
  'Feature request',
  'Other',
];

const Support: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState(SUPPORT_TOPICS[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    document.title = 'Support | OnlyFast';
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const emailSubject = `[OnlyFast Support] ${subject.trim()}`;
    const emailBody = [
      `Name: ${name.trim()}`,
      `Reply email: ${email.trim()}`,
      `Topic: ${topic}`,
      '',
      message.trim(),
    ].join('\n');

    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  };

  return (
    <main className="min-h-screen bg-[#F5F5F7] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center rounded-md focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
          aria-label="Back to OnlyFast"
        >
          <img src={LOGO_URL} alt="OnlyFast" className="h-12 w-auto" />
        </Link>

        <section className="mt-6 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <header className="border-b border-[#E5E7EB] bg-gradient-to-br from-[#1A1B23] to-[#2D303B] px-6 py-8 text-white sm:px-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#00A8E8]/15 text-[#00A8E8]">
              <MessageCircleQuestion aria-hidden="true" className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-3xl font-bold">How can we help?</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#D1D5DB]">
              Tell us what you need and we’ll prepare an email to the OnlyFast support team.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-5 p-6 sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="support-name" className="block text-sm font-semibold text-[#1A1B23]">
                  Name
                </label>
                <input
                  id="support-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-sm text-[#1A1B23] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="support-email" className="block text-sm font-semibold text-[#1A1B23]">
                  Email
                </label>
                <input
                  id="support-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-sm text-[#1A1B23] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="support-topic" className="block text-sm font-semibold text-[#1A1B23]">
                What can we help with?
              </label>
              <select
                id="support-topic"
                name="topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-sm text-[#1A1B23] outline-none transition focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20"
              >
                {SUPPORT_TOPICS.map((supportTopic) => (
                  <option key={supportTopic} value={supportTopic}>
                    {supportTopic}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="support-subject" className="block text-sm font-semibold text-[#1A1B23]">
                Subject
              </label>
              <input
                id="support-subject"
                name="subject"
                type="text"
                required
                maxLength={120}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-sm text-[#1A1B23] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20"
                placeholder="A short summary of your issue"
              />
            </div>

            <div>
              <div className="flex items-end justify-between gap-4">
                <label htmlFor="support-message" className="block text-sm font-semibold text-[#1A1B23]">
                  Message
                </label>
                <span className="text-xs text-[#9CA3AF]">{message.length}/2000</span>
              </div>
              <textarea
                id="support-message"
                name="message"
                required
                rows={7}
                maxLength={2000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="mt-2 w-full resize-y rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-sm leading-relaxed text-[#1A1B23] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20"
                placeholder="Include any details that will help us understand the problem."
              />
            </div>

            <div className="rounded-xl border border-[#BAE6FD] bg-[#F0F9FF] px-4 py-3 text-xs leading-relaxed text-[#075985]">
              Clicking the button below opens your email app with this message addressed to{' '}
              <span className="font-semibold">{SUPPORT_EMAIL}</span>. Review it there, then send.
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00A8E8] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0096CF] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2 sm:w-auto"
            >
              <Mail aria-hidden="true" className="h-4 w-4" />
              Continue to email
            </button>
          </form>
        </section>

        <p className="mt-5 text-center text-xs text-[#6B7280]">
          Prefer to email us directly?{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-semibold text-[#00A8E8] underline-offset-2 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </main>
  );
};

export default Support;
