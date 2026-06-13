import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

/* The mode boot (aesthetic, ADOPTING §3): read the persisted choice
   before first paint so the page never flashes the wrong mode. */
const modeBoot = `try{var m=localStorage.getItem('ae-mode');if(m==='dark'||m==='light'){document.documentElement.classList.add(m);document.documentElement.style.colorScheme=m;}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: modeBoot }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
