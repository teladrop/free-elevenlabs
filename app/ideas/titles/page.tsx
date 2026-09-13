'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Title Generator is now merged into the main /ideas page (Titles tab)
export default function TitlesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/ideas'); }, [router]);
  return null;
}
