import type { Metadata, Viewport } from "next";
import { Geist_Mono, TASA_Orbiter } from "next/font/google";
import { AppShell } from "../components/ui/app-shell";
import { Movimento } from "../components/ui/movimento";
import { TemaSalvo } from "../components/ui/tema";
import { ToastProvider } from "../components/ui/toast";
import "./globals.css";

const orbiter = TASA_Orbiter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-orbiter",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Prumo",
  description: "Agenda e finanças no mesmo dia.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${orbiter.variable} ${mono.variable} h-full`}>
      <body>
        <Movimento>
          <ToastProvider>
            <TemaSalvo />
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </Movimento>
      </body>
    </html>
  );
}
