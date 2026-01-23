"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useState } from "react";

export default function TestLoginPage() {
  const { data: session, status } = useSession();
  const sessionUser = session?.user as { role?: string; firstName?: string; lastName?: string; email?: string } | undefined;
  const [email, setEmail] = useState("adam@gmail.com");
  const [password, setPassword] = useState("adam90053729");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      
      console.log("Login result:", result);
      
      if (result?.error) {
        alert(`Login failed: ${result.error}`);
      } else {
        alert("Login successful!");
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
    document.cookie.split(";").forEach(function(c) { 
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
            {session && (
              <div className="mt-2 p-3 bg-gray-100 rounded">
                <p><strong>User:</strong> {sessionUser?.email}</p>
                <p><strong>Role:</strong> {sessionUser?.role}</p>
                <p><strong>Name:</strong> {sessionUser?.firstName} {sessionUser?.lastName}</p>
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
