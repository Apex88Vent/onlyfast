
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import Upgrade from "./pages/Upgrade";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import DeleteAccount from "./pages/DeleteAccount";
import Support from "./pages/Support";
import SafeBackHandler from "./components/SafeBackHandler";
import BetaRoute from "./components/BetaRoute";
import { BetaFeaturesProvider } from "./contexts/BetaFeaturesContext";
import { BETA_FEATURES } from "./lib/betaFeatures";
import MedianPickerTracePanel from "./components/MedianPickerTracePanel";

const queryClient = new QueryClient();
const OnboardingPreview = lazy(() => import("./pages/OnboardingPreview"));
const RookieAdSlotPreview = lazy(() => import("./pages/RookieAdSlotPreview"));

const App = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <BetaFeaturesProvider>
            <SafeBackHandler />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/account" element={<Index />} />
              <Route path="/upgrade" element={<Upgrade />} />
              <Route path="/pricing" element={<Upgrade />} />
              <Route path="/checkout" element={<Upgrade />} />
              <Route path="/subscription/success" element={<SubscriptionSuccess />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/delete-account" element={<DeleteAccount />} />
              <Route path="/support" element={<Support />} />
              <Route
                path="/onboarding-preview"
                element={
                  <BetaRoute feature={BETA_FEATURES.onboardingPreviewRoute}>
                    <Suspense fallback={<div className="min-h-screen bg-[#F5F5F7]" aria-busy="true" />}>
                      <OnboardingPreview />
                    </Suspense>
                  </BetaRoute>
                }
              />
              <Route
                path="/rookie-ad-slot-preview"
                element={
                  <BetaRoute feature={BETA_FEATURES.rookieAdSlotPreviewRoute}>
                    <Suspense fallback={<div className="min-h-screen bg-[#F5F5F7]" aria-busy="true" />}>
                      <RookieAdSlotPreview />
                    </Suspense>
                  </BetaRoute>
                }
              />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <MedianPickerTracePanel />
          </BetaFeaturesProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
