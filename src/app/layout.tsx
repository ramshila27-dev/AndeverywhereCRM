import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getCurrentUser } from "@/lib/auth";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Andeverywhere — Travel CRM",
  description:
    "Andeverywhere — B2B travel enquiries, quotes and itineraries with contracted rates, all in one place.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        {user ? (
          <>
            <Navbar user={user} />
            <main className="w-full flex-1 px-4 py-8 sm:px-6 lg:px-10">
              {children}
            </main>
            <Footer />
          </>
        ) : (
          // Unauthenticated (login) pages render without the app chrome.
          <main className="flex-1">{children}</main>
        )}
      </body>
    </html>
  );
}
