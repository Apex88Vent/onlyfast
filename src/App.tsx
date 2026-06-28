
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
import OnboardingPreview from "./pages/OnboardingPreview";
import RookieAdSlotPreview from "./pages/RookieAdSlotPreview";
import SafeBackHandler from "./components/SafeBackHandler";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SafeBackHandler />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/account" element={<Index />} />
            <Route path="/upgrade" element={<Upgrade />} />
            <Route path="/pricing" element={<Upgrade />} />
            <Route path="/checkout" element={<Upgrade />} />
            <Route path="/subscription/success" element={<SubscriptionSuccess />} />
            <Route path="/onboarding-preview" element={<OnboardingPreview />} />
            {import.meta.env.DEV && (
              <Route path="/rookie-ad-slot-preview" element={<RookieAdSlotPreview />} />
            )}
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
