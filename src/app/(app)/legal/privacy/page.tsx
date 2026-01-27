import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Chrondle",
  description: "How we handle your data at Misty Step.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground text-sm">Last updated: November 23, 2025</p>

      <p>
        This Privacy Policy explains how Misty Step (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or
        &ldquo;our&rdquo;) collects, uses, and protects your information when you use Chrondle (the
        &ldquo;Game&rdquo;). We believe in data minimalism: we only collect what is strictly
        necessary to make the Game work.
      </p>

      <h2>1. Information We Collect</h2>
      <p>
        <strong>Gameplay Data:</strong> We store your game progress, guesses, and streaks. This data
        is associated with your anonymous session or user account to allow you to continue playing
        across devices.
      </p>
      <p>
        <strong>Device Information:</strong> We may collect basic technical information about your
        device and browser (e.g., user agent) to ensure compatibility and debug issues.
      </p>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To provide and maintain the Game service.</li>
        <li>To synchronize your progress across devices.</li>
        <li>To prevent fraud and abuse of our systems.</li>
        <li>
          To analyze aggregate gameplay statistics (e.g., &ldquo;Global Win Rate&rdquo;) to improve
          puzzle difficulty.
        </li>
      </ul>

      <h2>3. Data Storage & Cookies</h2>
      <p>
        We use local storage and essential cookies on your device to save your immediate game state
        and preferences (like Dark Mode). This allows the game to function even if you lose internet
        connectivity temporarily.
      </p>

      <h2>4. Third-Party Services</h2>
      <p>
        We use trusted third-party infrastructure to host the game and database. These providers
        adhere to strict security standards. We do not sell, trade, or rent your personal
        identification information to others.
      </p>

      <h2>5. Contact Us</h2>
      <p>
        If you have questions about this policy, please contact us at:{" "}
        <a href="mailto:hello@mistystep.io">hello@mistystep.io</a>.
      </p>
    </>
  );
}
