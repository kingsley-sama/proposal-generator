'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useActionState, useState } from 'react';
import { signIn, type ActionState } from '../actions';

export function SignInForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signIn,
    {}
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main
      className="min-h-[100dvh] bg-white text-[#16181D] flex flex-col items-center px-4 py-8"
      style={{ fontFamily: 'var(--font-manrope)' }}
    >
      {/* Back to homepage */}
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#16181D] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Zurück zur Startseite
        </Link>
      </div>

      <div className="flex-1 flex w-full items-center justify-center">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <Image
              src="/logo_2.png"
              alt="ExposéProfi"
              width={180}
              height={28}
              priority
              className="h-7 w-auto mb-6"
            />
            <h1 className="text-3xl font-bold tracking-tight">Willkommen zurück</h1>
            <p className="mt-2 text-gray-500">Melden Sie sich bei Ihrem Konto an</p>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8">
            <form action={formAction} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold mb-1.5">
                  E-Mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue={state.email}
                  placeholder="E-Mail eingeben"
                  className="w-full rounded-lg bg-gray-100 border border-transparent px-4 py-3 text-[15px] outline-none transition-colors placeholder:text-gray-400 focus:bg-white focus:border-[#AF2C32]/40 focus:ring-2 focus:ring-[#AF2C32]/15"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold mb-1.5">
                  Passwort
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="Passwort eingeben"
                    className="w-full rounded-lg bg-gray-100 border border-transparent px-4 py-3 pr-12 text-[15px] outline-none transition-colors placeholder:text-gray-400 focus:bg-white focus:border-[#AF2C32]/40 focus:ring-2 focus:ring-[#AF2C32]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" y1="2" x2="22" y2="22" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {state.error && (
                <p className="text-sm text-[#AF2C32]">{state.error}</p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-full bg-[#AF2C32] py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#962228] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pending ? 'Anmelden…' : 'Anmelden'}
              </button>
            </form>
          </div>

          {/* Footer badge */}
          <div className="mt-8 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-1.5 text-sm text-gray-500 hover:text-[#16181D] transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#AF2C32]" />
              — ExposéProfi
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
