import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { TabBar } from './TabBar';

export function TabbedLayout() {
  return (
    <>
      <Header />
      <main className="flex-1 overflow-y-auto px-5 py-4">
        <Outlet />
      </main>
      <TabBar />
    </>
  );
}
