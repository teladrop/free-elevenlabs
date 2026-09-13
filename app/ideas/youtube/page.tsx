'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// YouTube Ideas is now merged into the main /ideas page (Ideas tab)
export default function YouTubeIdeasRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/ideas'); }, [router]);
  return null;
}
