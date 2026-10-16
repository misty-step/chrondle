import localFont from "next/font/local";
import "./globals.css";

const outfit = localFont({
  src: "./fonts/Outfit.ttf",
  weight: "400 700",
  variable: "--font-outfit",
  display: "swap",
});

const karla = localFont({
  src: "./fonts/Karla.ttf",
  weight: "400 700",
  variable: "--font-karla",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${karla.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
