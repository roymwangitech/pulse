import { Suspense } from 'react';
import ExplorePage from './explore-content';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
      <ExplorePage />
    </Suspense>
  );
}
