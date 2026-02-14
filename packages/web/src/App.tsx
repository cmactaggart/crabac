import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.js';
import { useDMStore } from './stores/dm.js';
import { usePresence } from './hooks/usePresence.js';
import { useDMUnreadSocket } from './hooks/useDMUnreadSocket.js';
import { useIsMobile } from './hooks/useIsMobile.js';
import { useTabNotifications } from './hooks/useTabNotifications.js';
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';
import { VerifyEmail } from './pages/VerifyEmail.js';
import { MagicLink } from './pages/MagicLink.js';
import { MfaChallenge } from './pages/MfaChallenge.js';
import { InviteLanding } from './pages/InviteLanding.js';
import { SpaceView } from './pages/SpaceView.js';
import { DMView } from './pages/DMView.js';
import { Home } from './pages/Home.js';
import { AdminPanel } from './pages/AdminPanel.js';
import { NotificationsPage } from './pages/NotificationsPage.js';
import { AccountPage } from './pages/AccountPage.js';
import { BottomTabBar } from './components/layout/BottomTabBar.js';
import { PublicSpaceLanding } from './pages/PublicSpaceLanding.js';
import { BoardLayout } from './pages/boards/BoardLayout.js';
import { BoardHome } from './pages/boards/BoardHome.js';
import { BoardThreadList } from './pages/boards/BoardThreadList.js';
import { BoardThreadDetail } from './pages/boards/BoardThreadDetail.js';
import { BoardRegister } from './pages/boards/BoardRegister.js';
import { BoardLogin } from './pages/boards/BoardLogin.js';

export function App() {
  const { user, loading, restore } = useAuthStore();
  usePresence(!!user);
  useDMUnreadSocket(!!user);
  useTabNotifications();
  const isMobile = useIsMobile();

  useEffect(() => {
    restore();
  }, [restore]);

  // Fetch DM unreads globally so SpaceSidebar badge works everywhere
  useEffect(() => {
    if (user) {
      useDMStore.getState().fetchDMUnreads();
    }
  }, [user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/auth/magic" element={<MagicLink />} />
        <Route path="/mfa-challenge" element={<MfaChallenge />} />
        <Route path="/invite/:code" element={<InviteLanding />} />
        <Route path="/space/:spaceId/channel/:channelId/message/:messageId" element={user ? <SpaceView /> : <Navigate to="/login" />} />
        <Route path="/space/:spaceId/channel/:channelId" element={user ? <SpaceView /> : <Navigate to="/login" />} />
        <Route path="/space/:spaceId" element={user ? <SpaceView /> : <Navigate to="/login" />} />
        <Route path="/dm/:conversationId/message/:messageId" element={user ? <DMView /> : <Navigate to="/login" />} />
        <Route path="/dm/:conversationId" element={user ? <DMView /> : <Navigate to="/login" />} />
        <Route path="/dm" element={user ? <DMView /> : <Navigate to="/login" />} />
        <Route path="/admin" element={user?.isAdmin ? <AdminPanel /> : <Navigate to="/" />} />
        <Route path="/notifications" element={user ? <NotificationsPage /> : <Navigate to="/login" />} />
        <Route path="/account" element={user ? <AccountPage /> : <Navigate to="/login" />} />
        <Route path="/space/slug/:slug" element={<PublicSpaceLanding />} />
        <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
        {/* Public board routes (no auth guard) */}
        <Route path="/boards/:spaceSlug" element={<BoardLayout />}>
          <Route index element={<BoardHome />} />
          <Route path="register" element={<BoardRegister />} />
          <Route path="login" element={<BoardLogin />} />
          <Route path=":channelName" element={<BoardThreadList />} />
          <Route path=":channelName/:threadId" element={<BoardThreadDetail />} />
        </Route>
      </Routes>
      {isMobile && user && <BottomTabBar />}
    </>
  );
}
