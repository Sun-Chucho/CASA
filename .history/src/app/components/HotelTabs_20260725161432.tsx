"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Download, Smartphone, Info } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function HotelTabs() {
  const [activeTab, setActiveTab] = useState<'standard' | 'platinum'>('standard');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installFeedback, setInstallFeedback] = useState("");
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsStandaloneApp(standalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") {
        setInstallFeedback("CASA is being installed successfully!");
      } else {
        setInstallFeedback("Installation dismissed.");
      }
    } else {
      setInstallFeedback("Please use your browser's menu to install CASA as a PWA app.");
    }
  };

  const standardLinks = [
    { name: "Barista POS", url: "/SBAR" },
    { name: "Reception Booking", url: "/SRB" },
    { name: "Standard Kitchen", url: "/SKIT" },
    { name: "Standard Inventory Manager", url: "/SIM" },
    { name: "Manager", url: "/smanager" },
  ];

  const premiumLinks = [
    { name: "Premium Barista POS", url: "/PBAR" },
    { name: "Premium Reception Booking", url: "/PRB" },
    { name: "Premium Kitchen POS", url: "/PKIT" },
    { name: "Premium Inventory Manager", url: "/PIM" },
    { name: "Premium Manager", url: "/pmanager" },
  ];

  const currentLinks = activeTab === 'standard' ? standardLinks : premiumLinks;

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.94)), url('/logo.png')",
        backgroundSize: "contain",
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white/95 backdrop-blur shadow-2xl overflow-hidden border border-gray-200">
        {/* Title / Branding */}
        <div className="p-6 text-center border-b border-gray-200 bg-gray-100/80">
          <h1 className="text-3xl font-black tracking-tight text-gray-900">CASA</h1>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mt-1">Smart Hotel Management Suite</p>
        </div>

        {/* Tab selector */}
        <div className="flex bg-gray-100 p-1 m-4 rounded-xl">
          <button
            type="button"
            className={`flex-1 py-3 text-center font-bold text-sm rounded-lg transition-all duration-200 ${
              activeTab === 'standard'
                ? 'bg-gray-900 text-white shadow'
                : 'text-gray-600 hover:text-gray-950'
            }`}
            onClick={() => setActiveTab('standard')}
          >
            Standard Dashboard
          </button>
          <button
            type="button"
            className={`flex-1 py-3 text-center font-bold text-sm rounded-lg transition-all duration-200 ${
              activeTab === 'platinum'
                ? 'bg-gray-800 text-white shadow'
                : 'text-gray-600 hover:text-gray-950'
            }`}
            onClick={() => setActiveTab('platinum')}
          >
            Premium Dashboard
          </button>
        </div>

        {/* Links to login pages */}
        <div className="px-6 pb-6 pt-2 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Available Portals</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentLinks.map((link) => (
              <Link
                key={link.name}
                href={link.url}
                className={`flex items-center justify-center p-4 rounded-xl font-bold text-center border text-sm transition-all duration-200 ${
                  activeTab === 'standard'
                    ? 'border-gray-300 bg-gray-50 text-gray-800 hover:bg-gray-900 hover:text-white hover:border-gray-900'
                    : 'border-gray-300 bg-gray-50 text-gray-800 hover:bg-gray-900 hover:text-white hover:border-gray-900'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Chrome PWA Install Button inside the app */}
          {!isStandaloneApp && (
            <div className="mt-6 pt-5 border-t border-gray-100">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-left">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-600 text-white shadow-sm">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900">Install CASA App</h3>
                    <p className="text-xs font-medium text-gray-600 mt-1 leading-relaxed">
                      Install this app on Chrome/Browser to access offline modes, shortcuts, and instant launch.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleInstallApp}
                  className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-gray-900 text-white hover:bg-black active:bg-gray-800 font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
                >
                  <Download className="h-4 w-4" />
                  {installPrompt ? "Install Now" : "Show Install Steps"}
                </button>

                {installFeedback && (
                  <p className="mt-2 text-xs font-semibold text-gray-700 flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-gray-200">
                    <Info className="h-3 w-3 shrink-0" /> {installFeedback}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
