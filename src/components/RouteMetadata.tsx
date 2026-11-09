import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isNativeApp } from '@/lib/paymentVisibility';

const publicPaths = new Set([
  '/',
  '/privacy-policy',
  '/terms-of-service',
  '/support',
  '/delete-account',
]);
export default function RouteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const indexable = publicPaths.has(pathname) && !isNativeApp;
    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute('content', indexable ? 'index, follow' : 'noindex, nofollow');
    document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute(
        'href',
        `https://onlyfast.app${publicPaths.has(pathname) ? pathname : '/app'}`,
      );
    document.title =
      pathname === '/' && !isNativeApp
        ? 'OnlyFast | Race Smarter. Finish Faster.'
        : 'OnlyFast | Racing Setup & Performance';
  }, [pathname]);
  return null;
}
