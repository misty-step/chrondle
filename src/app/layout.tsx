import "./globals.css";

const fontLinkHref =
  "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Karla:wght@400;500;600;700&display=swap";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={fontLinkHref} rel="stylesheet" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
