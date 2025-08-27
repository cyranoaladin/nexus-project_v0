"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function TestLoginPage() {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("adam@gmail.com");
  const [password, setPassword] = useState("adam90053729");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: email,
        password: password,
      });

      if (result?.ok) {
        router.push('/dashboard');
      } else {
        setError('Invalid credentials');
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Login error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
  };

  const clearSession = () => {
    // Clear all cookies
    document.cookie.split(";").forEach(function (c) {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    localStorage.clear();
    sessionStorage.clear();
    alert("Session cleared. Please refresh the page.");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Test Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Test the authentication system
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Current Session Status:</h3>
            <p className="text-sm text-gray-600">
              Status: {status}
            </p>
            {status === 'authenticated' && session && (
              <div className="mt-2 p-3 bg-gray-100 rounded" data-testid="session-card">
                <p><strong>User:</strong> <span data-testid="session-email">{session.user?.email}</span></p>
                <p><strong>Role:</strong> <span data-testid="session-role">{(session.user as any)?.role}</span></p>
                <p><strong>Name:</strong> {(session.user as any)?.firstName} {(session.user as any)?.lastName}</p>
                <p><strong>StudentId:</strong> <span data-testid="session-studentId">{(session.user as any)?.studentId || ''}</span></p>
                <p><strong>ParentId:</strong> <span data-testid="session-parentId">{(session.user as any)?.parentId || ''}</span></p>
              </div>
            )}
          </div>

          {!session ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? "Logging in..." : "Login"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <button
                onClick={handleLogout}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Logout
              </button>
            </div>
          )}

          <div className="border-t pt-4">
            <h3 className="text-lg font-medium mb-2">Debug Actions:</h3>
            <button
              onClick={clearSession}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Clear Session Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
