import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <div>
      <nav>Navigation - To be implemented</nav>
      <main>
        <Suspense fallback={<div>Loading...</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
