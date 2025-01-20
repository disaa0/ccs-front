'use client';

import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import { logEvent } from '@/lib/logEvent';

export default function AuthPage() {
  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        await logEvent(user.username, "login", "User logged in");
        router.push('/dashboard');
      }
    } catch (error) {
      console.log('Not authenticated');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full">
        <Authenticator
          initialState="signIn"
          components={{
            Header() {
              return (
                <div className="text-center py-6">
                  <h1 className="text-2xl font-bold text-gray-900">
                    Cloud Storage System
                  </h1>
                </div>
              );
            },
          }}
          services={{
            async validateCustomSignUp(formData) {
              const errors: { [key: string]: string } = {};
              return errors;
            },
          }}
        >
          {({ user }) => {
            // Redirect if user exists
            if (user) {
              logEvent(user.username, "login", "User logged in");
              router.push('/dashboard');
              return (
                <div className="text-center py-6">
                  <p className="text-gray-500">Redirecting to the dashboard...</p>
                </div>
              );
            }

            // Fallback UI when no user is authenticated
            return (
              <div className="text-center py-6">
                <p className="text-gray-500">Please wait...</p>
              </div>
            );
          }}
        </Authenticator>
      </div>
    </div>
  );
}
