import "./globals.css";

const fontLinkHref =
  "https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=Archivo+Narrow:wght@400;500;600;700&family=Newsreader:ital,wght@0,300..800;1,300..800&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap";

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
