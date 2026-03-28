"use client"
import React, { useEffect, useState } from 'react';

import { Mail, Lock, ArrowRight, Twitter, Github, Eye, EyeOff, Loader, Key } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import { useRouter } from 'next/navigation';
const VerifyEmailPage = () => {
  const router = useRouter();
  const getEmailFromLocalStorage = () => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('emailForVerification') ||
        localStorage.getItem('signupEmail') ||
        ''
      );
    }

    return '';
  }
  const clearEmailFromLocalStorage = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('emailForVerification');
      localStorage.removeItem('signupEmail');
    }
  }
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [otp, setOtp] = useState('');

  useEffect(() => {
    setEmail(getEmailFromLocalStorage());
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await axios.post('/api/auth/verify-email', { email });
      if (response.status === 200) {

        setSuccess('Verification OTP sent to your email.');
        setError('');
        setIsModalOpen(true);
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'An error occurred. Please try again.');
      setSuccess('');
    } finally {
      setLoading(false);
    }
  }

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await axios.patch('/api/auth/verify-email', { email, otp });
      if (response.status === 200) {
        setSuccess('Your email has been verified successfully. Redirecting to dashboard...');
        setError('');
        setIsModalOpen(false);
        clearEmailFromLocalStorage();
        setTimeout(() => {
          router.push('/signin');
        }, 2000);
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'An error occurred. Please try again.');
      setSuccess('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
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
              <h2 className="text-3xl font-bold mb-2">
                Verify Your Email Address
              </h2>
              <p className="text-lg text-slate-200 leading-relaxed font-medium mb-6">
                Here are steps to verify your email address:
              </p>
              <ul className="list-disc list-inside mt-2 text-slate-300 flex flex-col gap-1 font-semibold">
                <li>Check your email inbox for the verification code.</li>
                <li>Enter the received code in the verification field.</li>
                <li>
                  If you didn't receive the code, check your spam or junk folder.
                </li>
                <li>Request a new code if necessary.</li>
                <li>Once verified, you can proceed to access your account.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 bg-white">
          <div className="w-full max-w-md">

            <div className="mb-10">
              <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">
                Verify Your Email Address
              </h2>
              <p className="text-slate-600">
                Enter your email address below and we'll send you an verification code to verify your email.
              </p>
            </div>

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
                  className="pl-10"
                />
              </div>

              <Button
                type="submit" variant={"accent"} size={"lg"}
                className='w-full'
                disabled={loading}
                onClick={handleSendOtp}
              >
                {loading ? (<Loader className="animate-spin h-5 w-5 mx-auto" />) : 'Send Verification Code'}
              </Button>
            </form>

            <div className="relative flex items-center justify-center my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <span className="relative z-10 bg-white px-3 text-sm text-slate-500">
                or
              </span>
            </div>

            <div className="text-center mt-8">
              <p className="text-sm text-slate-600">
                Want to try again?
                <Link href="/signin" className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors ml-1">
                  Sign In
                </Link>
              </p>
            </div>

          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-md">
            {error && (
              <div className="mb-4 p-4 bg-red-100 text-red-700 border border-red-300 rounded">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-4 bg-green-100 text-green-700 border border-green-300 rounded">
                {success}
              </div>
            )}
            <h2 className="text-2xl font-bold mb-4">Enter Verification Code</h2>

            <Input
              type="number"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter OTP received via email"
              className='pl-6 text-center'
            />
            <div className="mt-6 flex justify-end">
              <Button
                variant="secondary"
                className="mr-4"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="accent"
                onClick={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? (<Loader className="animate-spin h-5 w-5 mx-auto" />) : 'Verify Code'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VerifyEmailPage;