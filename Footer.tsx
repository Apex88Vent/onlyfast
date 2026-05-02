import React from 'react';

interface FooterProps {
  onPrivacyClick: () => void;
  onTermsClick: () => void;
}

const Footer: React.FC<FooterProps> = ({ onPrivacyClick, onTermsClick }) => {
  return (
    <footer role="contentinfo" className="bg-white border-t border-[#E5E7EB] mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="https://d64gsuwffb70l.cloudfront.net/688263e7085fd34dcdf7f46a_1775752881652_48fe46d9.png"
              alt="OnlyFast logo"
              className="h-[30px] w-auto"
            />


            <span className="text-xs text-[#9CA3AF]">
              &copy; {new Date().getFullYear()} OnlyFast. All rights reserved.
            </span>
          </div>
          <nav aria-label="Legal links" className="flex items-center gap-4">
            <button
              onClick={onPrivacyClick}
              className="text-xs text-[#6B7280] hover:text-[#00A8E8] transition-colors underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2 rounded"
            >
              Privacy Policy
            </button>
            <button
              onClick={onTermsClick}
              className="text-xs text-[#6B7280] hover:text-[#00A8E8] transition-colors underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2 rounded"
            >
              Terms of Service
            </button>
            <a
              href="mailto:admin@onlyfast.ai"
              className="text-xs text-[#6B7280] hover:text-[#00A8E8] transition-colors underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2 rounded"
            >
              Contact Support
            </a>
          </nav>
        </div>
        <div className="mt-4 pt-4 border-t border-[#F0F0F2]">
          <p className="text-[10px] text-[#9CA3AF] text-center leading-relaxed max-w-3xl mx-auto">
            <strong>Disclaimer:</strong> OnlyFast is a setup tracking and suggestion tool only. 
            Motorsport racing is inherently dangerous. OnlyFast assumes no responsibility for injuries, 
            damages, or death. AI suggestions are for informational purposes only and do not guarantee 
            driver safety or performance outcomes. Always consult with qualified professionals.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
