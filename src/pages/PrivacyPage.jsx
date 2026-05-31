import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 px-4 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/"
            className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block"
          >
            ← Back to App
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-slate-400 text-sm">
            <strong>Effective Date:</strong> May 28, 2026
            <br />
            <strong>Last Updated:</strong> May 28, 2026
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-slate max-w-none space-y-6 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">1. Introduction</h2>
            <p>
              This Privacy Policy describes how <strong>Cabanatuan Community of Faith Baptist Church (CCFBC)</strong> ("we," "us," or "our") collects, uses, and protects your information when you use the <strong>Line Up Manager</strong> mobile application and web app (the "Service").
            </p>
            <p>By using the Service, you agree to the collection and use of information in accordance with this policy.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">2. Information We Collect</h2>

            <h3 className="text-xl font-semibold text-white mt-4 mb-2">2.1 Information You Provide</h3>
            <p>When you create an account, we collect:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Email address</strong> (used as your account identifier)</li>
              <li><strong>Password</strong> (encrypted and never stored in plain text)</li>
              <li><strong>Display name</strong> (optional)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-4 mb-2">2.2 Information You Create</h3>
            <p>When you use the Service, you may create:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Songs</strong> (titles, lyrics, chord arrangements, keys, notes)</li>
              <li><strong>Lineups</strong> (worship service schedules, song assignments)</li>
              <li><strong>Church membership</strong> (which church you belong to, your role)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-4 mb-2">2.3 Device Information</h3>
            <p>For push notifications, we collect:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Firebase Cloud Messaging (FCM) token</strong> — a unique identifier for your device</li>
              <li><strong>Platform information</strong> (Android version, device model — for compatibility)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-4 mb-2">2.4 Information We Do NOT Collect</h3>
            <p>We do <strong>not</strong> collect: phone numbers, location, contacts, photos, camera/microphone access, browsing history, advertising identifiers, or analytics data.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">3. How We Use Your Information</h2>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li><strong>Provide the Service</strong> — let you create songs, manage lineups, coordinate with your worship team</li>
              <li><strong>Authenticate you</strong> — verify your identity when you sign in</li>
              <li><strong>Send notifications</strong> — notify you about new lineups, song updates, team assignments</li>
              <li><strong>Maintain data isolation</strong> — ensure each church's data is private and only visible to its members</li>
              <li><strong>Improve the Service</strong> — diagnose technical issues</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">4. How We Share Your Information</h2>
            <p>We do <strong>not</strong> sell, rent, or trade your personal information to third parties.</p>

            <h3 className="text-xl font-semibold text-white mt-4 mb-2">4.1 Service Providers</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Supabase</strong> — database and authentication</li>
              <li><strong>Vercel</strong> — web hosting</li>
              <li><strong>Firebase / Google Cloud</strong> — push notification delivery</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-4 mb-2">4.2 Within Your Church</h3>
            <p>Songs and lineups you create are visible to other members of <strong>your church only</strong>. Members of other churches cannot see your data.</p>

            <h3 className="text-xl font-semibold text-white mt-4 mb-2">4.3 Legal Requirements</h3>
            <p>We may disclose your information if required by law, court order, or to protect the rights, safety, or property of CCFBC or its users.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">5. Data Security</h2>
            <p>We implement industry-standard security measures:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Encrypted passwords (never stored in plain text)</li>
              <li>HTTPS encryption for all data transmission</li>
              <li>Row-Level Security (RLS) for church-scoped data isolation</li>
              <li>JWT-based authentication for all API requests</li>
            </ul>
            <p className="mt-3">However, no method of transmission over the Internet is 100% secure.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">6. Data Retention</h2>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Account data</strong> — retained as long as your account is active</li>
              <li><strong>Songs and lineups</strong> — retained until you or a church admin deletes them</li>
              <li><strong>Push notification tokens</strong> — inactive tokens are automatically deactivated</li>
              <li><strong>Deleted data</strong> — permanently removed within 30 days</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Access</strong> your personal data</li>
              <li><strong>Correct</strong> inaccurate personal data</li>
              <li><strong>Delete</strong> your account and associated data</li>
              <li><strong>Withdraw consent</strong> at any time</li>
              <li><strong>Object</strong> to specific uses of your data</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact us at{' '}
              <a href="mailto:graza.janjames22@gmail.com" className="text-blue-400 hover:text-blue-300">
                graza.janjames22@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">8. Children's Privacy</h2>
            <p>The Service is intended for users <strong>aged 13 and older</strong>.</p>
            <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
              <li>We do <strong>not</strong> knowingly collect information from children under 13</li>
              <li>Users aged 13–17 are encouraged to use the Service with parental consent and supervision</li>
              <li>If you believe a child under 13 has provided personal information, contact us immediately</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">9. Push Notifications</h2>
            <p>The Service uses push notifications to inform you about new lineups, song updates, and team assignments.</p>
            <p className="mt-2">You can disable push notifications at any time through your device's <strong>Settings → Apps → Line Up Manager → Notifications</strong>.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">10. Third-Party Services</h2>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                  Supabase Privacy Policy
                </a>
              </li>
              <li>
                <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                  Vercel Privacy Policy
                </a>
              </li>
              <li>
                <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                  Google Firebase Privacy Policy
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">11. International Data Transfers</h2>
            <p>
              The Service is operated from the Philippines, but our service providers may store data in servers located in other countries. By using the Service, you consent to these transfers.
            </p>
            <p className="mt-2">
              All transfers are protected in line with the Philippines <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">12. Changes to This Privacy Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you by posting the new policy in the app, updating the "Last Updated" date, and sending in-app notifications for significant changes.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">13. Compliance</h2>
            <p>This Privacy Policy complies with:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Philippines Data Privacy Act of 2012 (RA 10173)</li>
              <li>Google Play Developer Program Policies</li>
              <li>Children's Online Privacy Protection Act (COPPA) for users 13 and older</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">14. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact:</p>
            <div className="mt-3 p-4 bg-slate-800 rounded-lg">
              <p><strong>Cabanatuan Community of Faith Baptist Church (CCFBC)</strong></p>
              <p>
                Email:{' '}
                <a href="mailto:graza.janjames22@gmail.com" className="text-blue-400 hover:text-blue-300">
                  graza.janjames22@gmail.com
                </a>
              </p>
              <p>Location: Cabanatuan City, Philippines</p>
            </div>
          </section>

          <p className="text-slate-500 text-sm mt-12 text-center italic">
            This Privacy Policy is effective as of May 28, 2026.
          </p>
        </div>
      </div>
    </div>
  );
}
