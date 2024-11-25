'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const redirect = () => {
      router.push('/auth');
    };
    redirect();
  }, [router]);

  return null;
}
