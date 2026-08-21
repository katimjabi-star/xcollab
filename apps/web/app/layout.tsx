import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppFrame } from "../components/shell/app-frame.tsx";
import { AuthGate } from "../components/auth-gate.tsx";
import { Toasts } from "../components/toasts.tsx";
import { AuthProvider } from "../lib/auth-context.tsx";
import { ToastProvider } from "../lib/toast-context.tsx";
import { UiProvider } from "../lib/ui-context.tsx";
import "./globals.css";
import "./styles/shell2.css";

export const metadata: Metadata = {
  title: "XCollab",
  description: "AI-native project orchestration — describe the mission, the project builds itself.",
};

/* Browser chrome color matches --background in each scheme (tokens.css). */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

/* Runs before first paint so a pinned theme never flashes the wrong mode.
   Mirrors the mobile contract: only "system" consults the OS. */
const THEME_BOOTSTRAP = `(function(){try{var m=localStorage.getItem("xcollab.theme");if(m==="light"||m==="dark"){document.documentElement.dataset.theme=m;}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <UiProvider>
          <AuthProvider>
            <ToastProvider>
              <AuthGate>
                <AppFrame>{children}</AppFrame>
              </AuthGate>
              <Toasts />
            </ToastProvider>
          </AuthProvider>
        </UiProvider>
      </body>
    </html>
  );
}
