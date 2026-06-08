import { Link } from 'react-router-dom';

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 px-4 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link to="/" className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block">
            ← Back to App
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Delete Your Account</h1>
          <p className="text-slate-400 text-sm">
            <strong>App:</strong> Line Up Manager &nbsp;·&nbsp; <strong>Developer:</strong> devjjpg
          </p>
        </div>

        <div className="space-y-6 text-slate-300 leading-relaxed">
          <section className="p-5 rounded-2xl border border-red-900/50 bg-red-950/20">
            <h2 className="text-xl font-semibold text-red-300 mb-2">⚠ This action is permanent</h2>
            <p>
              Deleting your account cannot be undone. Once confirmed, your account and personal
              data are permanently removed.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">How to Delete Your Account</h2>
            <p className="mb-3">Follow these steps from inside the app:</p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Open the <strong>Line Up Manager</strong> app and sign in.</li>
              <li>Tap <strong>Settings</strong> in the bottom navigation bar.</li>
              <li>Scroll to the <strong>Danger Zone</strong> section at the bottom of the page.</li>
              <li>Tap <strong>Delete My Account</strong>.</li>
              <li>Read the confirmation dialog and tap <strong>Delete my account</strong> to confirm.</li>
            </ol>
            <p className="mt-4 text-slate-400 text-sm">
              Your account will be deleted immediately after confirmation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">What Gets Deleted</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Your account</strong> — email address and password</li>
              <li><strong>Your display name</strong></li>
              <li><strong>Your church membership</strong> — your membership record and role</li>
              <li><strong>Your notification data</strong> — push notification tokens and notification history</li>
              <li><strong>Your schedule and lineup data</strong> — any worship lineups or song assignments linked to your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">Data Retention</h2>
            <p>
              Account and personal data are deleted immediately upon confirmation.
              Any backup or archived copies are permanently purged within <strong>90 days</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">Can't Access the App?</h2>
            <p>
              If you can no longer sign in to the app and need your account deleted, contact us
              directly and we will process the request manually:
            </p>
            <div className="mt-3 p-4 bg-slate-800 rounded-lg">
              <p>
                Email:{' '}
                <a
                  href="mailto:graza.janjames22@gmail.com"
                  className="text-blue-400 hover:text-blue-300"
                >
                  graza.janjames22@gmail.com
                </a>
              </p>
              <p className="text-slate-400 text-sm mt-1">
                Include the email address associated with your account in your message.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-3">Admin Accounts</h2>
            <p>
              If you are the only admin of a church that has other members, you must assign
              another member as admin before you can delete your account. This ensures other
              members retain access to their church data.
            </p>
          </section>

          <p className="text-slate-500 text-sm mt-12 text-center italic">
            Line Up Manager is developed by devjjpg for CCFBC (Cabanatuan Community of Faith Baptist Church Inc.)
          </p>
        </div>
      </div>
    </div>
  );
}
