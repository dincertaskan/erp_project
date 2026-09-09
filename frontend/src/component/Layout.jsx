import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function Layout({ children, notifications, setNotifications }) {
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <Navbar notifications={notifications} setNotifications={setNotifications} />
        <main className="p-6 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}