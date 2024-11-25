'use client';

import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';

export default function AuthPage() {
  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        // router.push('/dashboard');
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
              // if (!formData.username || formData.username.length < 3) {
              //   errors.username = 'Username must be at least 3 characters';
              // }
              return errors;
            },
          }}
        >
          {({ signOut, user }) => (
            <main>
              <h1>Hello {user?.username ?? 'Guest'}</h1>
              <button onClick={signOut}>Sign out</button>
            </main>
          )}
        </Authenticator>
      </div>
    </div>
  );
}
