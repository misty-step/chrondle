import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Chrondle",
  description: "Rules of the road for playing Chrondle.",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-muted-foreground text-sm">Last updated: November 23, 2025</p>

      <p>
        Please read these Terms of Service (&ldquo;Terms&rdquo;) carefully before playing Chrondle
        (the &ldquo;Game&rdquo;) operated by Misty Step.
      </p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using the Game, you agree to be bound by these Terms. If you disagree with
        any part of the terms, you may not access the Game.
      </p>

      <h2>2. Intellectual Property</h2>
      <p>
        The Game, including its original content, features, and functionality, is and will remain
        the exclusive property of Misty Step. The game mechanics, design systems, and code are
        protected by copyright and other intellectual property laws.
      </p>

      <h2>3. User Conduct</h2>
      <p>
        You agree not to use the Game for any unlawful purpose or in any way that could damage,
        disable, overburden, or impair our servers or networks. Automated scraping or
        &ldquo;botting&rdquo; of the Game is prohibited without express permission.
      </p>

      <h2>4. Disclaimer</h2>
      <p>
        The Game is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis. Misty
        Step makes no warranties, expressed or implied, regarding the reliability, accuracy, or
        availability of the Game. We reserve the right to modify or discontinue the Game at any
        time.
      </p>

      <h2>5. Limitation of Liability</h2>
      <p>
        In no event shall Misty Step be liable for any indirect, incidental, special, consequential,
        or punitive damages arising out of or related to your use of the Game.
      </p>

      <h2>6. Governing Law</h2>
      <p>
        These Terms shall be governed by and construed in accordance with the laws of the United
        States, without regard to its conflict of law provisions.
      </p>

      <h2>7. Contact</h2>
      <p>
        For any questions regarding these Terms, please contact us at:{" "}
        <a href="mailto:hello@mistystep.io">hello@mistystep.io</a>.
      </p>
    </>
  );
}
