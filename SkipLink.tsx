import React from 'react';

const SkipLink: React.FC = () => (
  <a
    href="#main-content"
    className="skip-link sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:bg-[#00A8E8] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
  >
    Skip to main content
  </a>
);

export default SkipLink;
