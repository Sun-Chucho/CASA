"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Download, Smartphone, Info } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function HotelTabs() {
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

  const links = [
    { name: "Hotel Manager", url: "/dashboard" },
    { name: "Reception Booking", url: "/dashboard/cashier" },
    { name: "Kitchen POS", url: "/dashboard/kitchen" },
    { name: "Barista POS", url: "/dashboard/barista" },
    { name: "Inventory Manager", url: "/dashboard/inventory" },
  ];

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "linear-gradient(rgba(17, 24, 39, 0.92), rgba(17, 24, 39, 0.92)), url('/casa-logo.svg')",
        backgroundSize: "contain",
      }}
    >
      <div className="w-full max-w-lg rounded-3xl bg-slate-950/95 backdrop-blur shadow-2xl overflow-hidden border border-slate-700 text-white">
        <div className="p-6 text-center border-b border-slate-800 bg-slate-900/90">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
            <img src="/casa-logo.svg" alt="CASA logo" className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">CASA</h1>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-300 mt-1">Smart Hotel Management Suite</p>
        </div>

        <div className="px-6 pb-6 pt-4 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400 mb-2">Available Portals</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {links.map((link) => (
              <Link
                key={link.name}
                href={link.url}
                className="flex items-center justify-center p-4 rounded-xl font-bold text-center border border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-amber-500 hover:text-slate-950 hover:border-amber-400 transition-all duration-200"
              >
                {link.name}
              </Link>
            ))}
          </div>

          {!isStandaloneApp && (
            <div className="mt-6 pt-5 border-t border-slate-800">
              <div className="bg-slate-900/70 rounded-xl p-4 border border-slate-700 text-left">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-slate-950 shadow-sm">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-white">Install CASA App</h3>
                    <p className="text-xs font-medium text-slate-300 mt-1 leading-relaxed">
                      Install this app on Chrome or your browser to access shortcuts, offline modes, and fast launch.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleInstallApp}
                  className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 active:bg-amber-300 font-bold text-xs uppercase tracking-[0.3em] transition-colors shadow-sm"
                >
                  <Download className="h-4 w-4" />
                  {installPrompt ? "Install Now" : "Show Install Steps"}
                </button>

                {installFeedback && (
                  <p className="mt-2 text-xs font-semibold text-slate-200 flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded border border-slate-700">
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
