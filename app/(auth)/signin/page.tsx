"use client"
import React, { useState, useEffect } from 'react';

import { Mail, Lock, ArrowRight, Twitter, Github, Eye, EyeOff, Loader, LinkedinIcon, Clock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface LastUsedProvider {
  provider: string;
  timestamp: number;
}

const SignInPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastUsedProviders, setLastUsedProviders] = useState<LastUsedProvider[]>([]);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('lastUsedAuthProviders');
    if (stored) {
      try {
        setLastUsedProviders(JSON.parse(stored));
      } catch (err) {
        console.error('Failed to parse stored providers:', err);
      }
    }
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      const response = await signIn('credentials', {
        email, password, redirect: false
      })
      if (response?.error) {
        setError(response.error);
        setTimeout(() => {
          if (response.error === "Please verify your email before logging in.") {
            localStorage.setItem('signupEmail', email);
            localStorage.setItem('emailForVerification', email);
            router.push("/verify-email")
          }
        }, 1500)
      } else {
        setSuccess("Login Sucessfull. Redirecting to Dashboard...")
        setTimeout(() => {
          router.push("/dashboard")
        }, 1500)
      }
    } catch (error) {
      console.log(error)
      setError("An error occurred during login");
    } finally {
      setLoading(false)
    }
  }
  const signInWithProvider = async (provider: string) => {
    setLoading(true);
    try {
      const now = Date.now();
      const updated = [
        { provider, timestamp: now },
        ...lastUsedProviders.filter(p => p.provider !== provider)
      ].slice(0, 3);

      localStorage.setItem('lastUsedAuthProviders', JSON.stringify(updated));
      setLastUsedProviders(updated);

      await signIn(provider, { callbackUrl: '/dashboard' });
    } catch (error: any) {
      setError(error.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'google':
        return (
          <svg height="16" width="16" viewBox="-3 0 262 262" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
            <path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4" />
            <path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853" />
            <path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05" />
            <path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335" />
          </svg>
        );
      case 'linkedin':
        return <LinkedinIcon className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getProviderDisplayName = (provider: string) => {
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  return (
    <div className="min-h-screen w-full flex">
      <div
        className="hidden lg:flex w-1/2 bg-cover bg-center relative overflow-hidden"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1639322537228-f710d846310a?q=80&w=2532&auto=format&fit=crop')`,
        }}
      >
        <div className="absolute inset-0 bg-black/50"></div>

        <div className="relative z-10 w-full h-full flex flex-col justify-between p-16 text-white">
          <Link href="/">
            <h1 className="text-4xl font-bold tracking-tight">Zyvarin.</h1>
          </Link>
          <div className="max-w-md">
            <h2 className="text-3xl font-bold mb-4">
              The AI-powered cross-posting engine for developers.
            </h2>
            <p className="text-lg text-slate-200 leading-relaxed">
              Write once, repurpose everywhere. Streamline your content workflow with intelligent automation.
            </p>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 bg-white">
        <div className="w-full max-w-md">

          <div className="mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">
              Welcome back
            </h2>
            <p className="text-slate-600">
              Sign in to your account to continue.
            </p>
          </div>
          {error && (
            <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 rounded-md">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 text-sm text-green-700 bg-green-100 rounded-md">
              {success}
            </div>
          )}

          <form className="space-y-6">
            <div className="relative">
              <label htmlFor="email" className="sr-only">Email address</label>
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <Input
                id="email"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <label htmlFor="password" className="sr-only">Password</label>
              <div className="absolute inset-y-0 -top-6 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className=" flex justify-end mt-2">
                <Link href="/forgot-password" className="text-xs font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
                  Forgot Password?
                </Link>
              </div>
              <div className="absolute inset-y-0 -top-5 right-0 pr-4 flex items-center">
                <button onClick={() => setShowPassword(!showPassword)}
                  type="button" className="text-xs font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
                  {showPassword ? <EyeOff className="h-5 w-5 text-slate-400" /> : <Eye className="h-5 w-5 text-slate-400" />}
                </button>
              </div>

            </div>

            <Button
              type="submit" variant={"accent"} size={"lg"}
              className='w-full'
              onClick={handleSignIn}
              disabled={email.trim() === '' || password.trim() === '' || loading}
            >
              {loading ? <Loader className="animate-spin h-5 w-5 mx-auto" /> : 'Sign In'}
            </Button>
          </form>

          <div className="relative flex items-center justify-center my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <span className="relative z-10 bg-white px-3 text-sm text-slate-500">
              or continue with
            </span>
          </div>

          {lastUsedProviders.length > 0 && (
            <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-100">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-semibold text-indigo-900">Last Used</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {lastUsedProviders.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => signInWithProvider(item.provider)}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition-all text-xs font-medium text-slate-700 shadow-sm hover:shadow-md disabled:opacity-50"
                  >
                    {getProviderIcon(item.provider)}
                    <span>{getProviderDisplayName(item.provider)}</span>
                    {index === 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-indigo-500 text-white text-xs rounded font-semibold">
                        Most Recent
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => signInWithProvider('google')}
              className="w-1/2 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all group flex items-center justify-center gap-2 text-sm font-medium text-slate-800">
              <svg height="20" width="20"
                viewBox="-3 0 262 262" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid"><path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4" /><path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853" /><path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05" /><path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335" /></svg>
              <span>Sign in with Google</span>
            </button>
            <button onClick={() => signInWithProvider('linkedin')}
              className="w-1/2 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all group flex items-center justify-center gap-2 text-sm font-medium text-slate-800 ">
              <LinkedinIcon className="w-5 h-5 text-[#1DA1F2]" />
              <span>Sign in with LinkedIn</span>
            </button>
          </div>

          <div className="text-center mt-8">
            <p className="text-sm text-slate-600">
              Don't have an account?{' '}
              <Link href="/signup" className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors ml-1">
                Create an account
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SignInPage;