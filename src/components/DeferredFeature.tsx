import React, { Component, lazy, Suspense, type ComponentType } from 'react';

/** Declare at module scope. Only code is shared; account data stays in its existing owner. */
export function deferredFeature<Props extends object>(
  loader: () => Promise<{ default: ComponentType<Props> }>,
  label: string,
) {
  let pending: ReturnType<typeof loader> | undefined;
  let ready: ComponentType<Props> | undefined;
  let failedUrl: URL | undefined;
  let retry = 0;
  const load = () => {
    if (!pending) {
      // Chromium can remember a failed module fetch. A fresh query retries that
      // one built asset, retaining all mounted application/draft state. Never
      // import an arbitrary URL from an error or retry a module evaluation error.
      const request = failedUrl
        ? import(/* @vite-ignore */ `${failedUrl.href}?onlyfast_retry=${++retry}`)
        : loader();
      pending = request.then(module => {
        ready = module.default;
        return module;
      }).catch(error => {
        if (typeof window !== 'undefined' && error instanceof TypeError &&
          /Failed to fetch dynamically imported module/.test(error.message)) {
          const address = error.message.match(/https?:\/\/[^\s]+/)?.[0];
          try {
            const url = new URL(address || '');
            if (url.origin === window.location.origin && !url.username && !url.password &&
              !url.search && !url.hash && /^\/assets\/[\w-]+\.js$/.test(url.pathname)) failedUrl = url;
          } catch { /* Other engines may omit the failed URL; retain the normal loader. */ }
        }
        pending = undefined;
        // A later visit must not reuse the rejected lazy identity from this visit.
        InitialFeature = lazy(load);
        throw error;
      });
    }
    return pending;
  };
  let InitialFeature = lazy(load);

  class FeatureBoundary extends Component<Props, { failed: boolean; Feature: typeof InitialFeature | ComponentType<Props> }> {
    // A completed intent preload should render immediately, without a new
    // Suspense round trip. Keep this identity for the lifetime of the instance.
    state = { failed: false, Feature: ready || InitialFeature };

    componentDidCatch() {
      this.setState({ failed: true });
    }

    retry = () => {
      // A rejected React.lazy promise is cached. Retry only on an explicit click,
      // without reloading the page or unmounting the parent that owns the draft.
      this.setState({ failed: false, Feature: ready || lazy(load) });
    };

    render() {
      const { Feature, failed } = this.state;
      const LoadedFeature = Feature as ComponentType<Props>;
      const placeholderStyle = { minHeight: '12rem' };
      if (failed) {
        return (
          <div role="alert" className="p-4" style={placeholderStyle}>
            <p>{label} could not load. Check your connection and try again.</p>
            <button type="button" className="underline" onClick={this.retry}>Try again</button>
          </div>
        );
      }
      return (
        <Suspense fallback={<div role="status" aria-live="polite" className="p-4" style={placeholderStyle}>Loading {label}…</div>}>
          <LoadedFeature {...this.props} />
        </Suspense>
      );
    }
  }

  return { Component: FeatureBoundary, preload: load };
}
