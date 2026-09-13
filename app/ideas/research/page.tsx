'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';

export default function OldResearchPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect old research path to new YouTube Research
    router.replace('/research');
  }, [router]);

  return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Redirecting to YouTube Research...</p>
        </div>
      </div>
    </AppLayout>
  );
}