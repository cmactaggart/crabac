import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.js';
import { useDMStore } from './stores/dm.js';
import { usePresence } from './hooks/usePresence.js';
import { useDMUnreadSocket } from './hooks/useDMUnreadSocket.js';
import { useIsMobile } from './hooks/useIsMobile.js';
import { useTabNotifications } from './hooks/useTabNotifications.js';
import { useSwipeNavigation } from './hooks/useSwipeNavigation.js';
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';
import { VerifyEmail } from './pages/VerifyEmail.js';
import { MagicLink } from './pages/MagicLink.js';
import { ForgotPassword } from './pages/ForgotPassword.js';
import { ResetPassword } from './pages/ResetPassword.js';
import { MfaChallenge } from './pages/MfaChallenge.js';
import { InviteLanding } from './pages/InviteLanding.js';
import { SpaceView } from './pages/SpaceView.js';
import { DMView } from './pages/DMView.js';
import { Home } from './pages/Home.js';
import { AdminPanel } from './pages/AdminPanel.js';
import { NotificationsPage } from './pages/NotificationsPage.js';
import { AccountPage } from './pages/AccountPage.js';
import { YouPage } from './pages/YouPage.js';
import { FeedPage } from './pages/FeedPage.js';
import { PostDetailPage } from './pages/PostDetailPage.js';
import { PublicProfilePage } from './pages/PublicProfilePage.js';
import { RouteBuilderPage } from './pages/RouteBuilderPage.js';
import { UpcomingEventsPage } from './pages/UpcomingEventsPage.js';
import { RecentPostsPage } from './pages/RecentPostsPage.js';
import { OnboardingModal } from './components/common/OnboardingModal.js';
import { api } from './lib/api.js';
import { BottomTabBar } from './components/layout/BottomTabBar.js';
import { PublicSpaceLanding } from './pages/PublicSpaceLanding.js';
import { PublicLayout } from './components/public/PublicLayout.js';
import { BoardHome } from './pages/boards/BoardHome.js';
import { BoardThreadList } from './pages/boards/BoardThreadList.js';
import { BoardThreadDetail } from './pages/boards/BoardThreadDetail.js';
import { BoardRegister } from './pages/boards/BoardRegister.js';
import { BoardLogin } from './pages/boards/BoardLogin.js';
import { PublicGalleryHome } from './pages/galleries/PublicGalleryHome.js';
import { PublicGalleryView } from './pages/galleries/PublicGalleryView.js';
import { PublicCalendarView } from './pages/calendar/PublicCalendarView.js';
import { PublicMeetingRoom } from './pages/calendar/PublicMeetingRoom.js';
import { PublicVoiceChannel } from './pages/voice/PublicVoiceChannel.js';
import { PublicRoutesHome } from './pages/routes/PublicRoutesHome.js';
import { PublicRoutesView } from './pages/routes/PublicRoutesView.js';
import { PublicBlogHome } from './pages/blog/PublicBlogHome.js';
import { PublicBlogPost } from './pages/blog/PublicBlogPost.js';
import { PublicNewsletterHome } from './pages/newsletter/PublicNewsletterHome.js';
import { PublicNewsletterDetail } from './pages/newsletter/PublicNewsletterDetail.js';
import { PublicPersonalNewsletterHome } from './pages/newsletter/PublicPersonalNewsletterHome.js';
import { PublicPersonalNewsletterDetail } from './pages/newsletter/PublicPersonalNewsletterDetail.js';
import { NewsletterPreferences } from './pages/newsletter/NewsletterPreferences.js';
import { NewsletterVerify } from './pages/newsletter/NewsletterVerify.js';
import { useCallSocket } from './hooks/useCallSocket.js';
import { useRingtone } from './hooks/useRingtone.js';
import { IncomingCallModal } from './components/calls/IncomingCallModal.js';
import { ActiveCallOverlay } from './components/calls/ActiveCallOverlay.js';
import { MeetingRoomOverlay } from './components/calls/MeetingRoomOverlay.js';
import { useCallStore } from './stores/call.js';
import { ToastContainer } from './components/common/ToastContainer.js';

export function App() {
  const { user, loading, restore } = useAuthStore();
  const activeEventId = useCallStore((s) => s.activeEventId);
  usePresence(!!user);
  useDMUnreadSocket(!!user);
  useCallSocket();
  useRingtone();
  useTabNotifications();
  useSwipeNavigation();
  const isMobile = useIsMobile();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    restore();
  }, [restore]);

  // Fetch DM unreads globally so SpaceSidebar badge works everywhere
  useEffect(() => {
    if (user) {
      useDMStore.getState().fetchDMUnreads();
      // Check onboarding status
      api('/users/preferences').then((prefs: any) => {
        if (!prefs.onboardingCompleted) setShowOnboarding(true);
      }).catch(() => {});
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
        <Route path="/forgot-password" element={user ? <Navigate to="/" /> : <ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
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
        <Route path="/feed" element={user ? <FeedPage /> : <Navigate to="/login" />} />
        <Route path="/you" element={user ? <YouPage /> : <Navigate to="/login" />} />
        <Route path="/route-builder" element={user ? <RouteBuilderPage /> : <Navigate to="/login" />} />
        <Route path="/events" element={user ? <UpcomingEventsPage /> : <Navigate to="/login" />} />
        <Route path="/recent-posts" element={user ? <RecentPostsPage /> : <Navigate to="/login" />} />
        <Route path="/p/:username/post/:postId" element={user ? <PostDetailPage /> : <Navigate to="/login" />} />
        <Route path="/p/:username" element={user ? <PublicProfilePage /> : <Navigate to="/login" />} />
        <Route path="/account" element={user ? <AccountPage /> : <Navigate to="/login" />} />
        <Route path="/space/slug/:slug" element={<PublicSpaceLanding />} />
        <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
        {/* Public board routes (no auth guard) */}
        <Route path="/boards/:spaceSlug" element={<PublicLayout pageType="boards" />}>
          <Route index element={<BoardHome />} />
          <Route path="register" element={<BoardRegister />} />
          <Route path="login" element={<BoardLogin />} />
          <Route path=":channelName" element={<BoardThreadList />} />
          <Route path=":channelName/:threadId" element={<BoardThreadDetail />} />
        </Route>
        {/* Public gallery routes (no auth guard) */}
        <Route path="/gallery/:spaceSlug" element={<PublicLayout pageType="gallery" />}>
          <Route index element={<PublicGalleryHome />} />
          <Route path=":channelName" element={<PublicGalleryView />} />
        </Route>
        {/* Public route library (no auth guard) */}
        <Route path="/routes/:spaceSlug" element={<PublicLayout pageType="routes" />}>
          <Route index element={<PublicRoutesHome />} />
          <Route path=":channelName" element={<PublicRoutesView />} />
        </Route>
        {/* Public calendar routes (no auth guard) */}
        <Route path="/calendar/:spaceSlug" element={<PublicLayout pageType="calendar" />}>
          <Route index element={<PublicCalendarView />} />
        </Route>
        {/* Public meeting room (no auth guard, standalone page) */}
        <Route path="/calendar/:spaceSlug/meeting/:eventId" element={<PublicMeetingRoom />} />
        <Route path="/calendar/:spaceSlug/meeting/:eventId/verify" element={<PublicMeetingRoom />} />
        {/* Public voice channel (no auth guard, standalone page) */}
        <Route path="/:spaceSlug/voice/:channelName" element={<PublicVoiceChannel />} />
        <Route path="/:spaceSlug/voice/:channelName/verify" element={<PublicVoiceChannel />} />
        {/* Public blog routes (no auth guard) */}
        <Route path="/blog/:spaceSlug" element={<PublicLayout pageType="blog" />}>
          <Route index element={<PublicBlogHome />} />
          <Route path=":postId" element={<PublicBlogPost />} />
        </Route>
        {/* Newsletter standalone pages (no layout wrapper) */}
        <Route path="/newsletter/preferences/:token" element={<NewsletterPreferences />} />
        <Route path="/newsletter/verify/:token" element={<NewsletterVerify />} />
        {/* Personal newsletter routes */}
        <Route path="/newsletter/u/:username/:newsletterId" element={<PublicPersonalNewsletterDetail />} />
        <Route path="/newsletter/u/:username" element={<PublicPersonalNewsletterHome />} />
        {/* Public newsletter routes (space) */}
        <Route path="/newsletter/:spaceSlug" element={<PublicLayout pageType="newsletter" />}>
          <Route index element={<PublicNewsletterHome />} />
          <Route path=":newsletterId" element={<PublicNewsletterDetail />} />
        </Route>
      </Routes>
      {isMobile && user && <BottomTabBar />}
      {showOnboarding && user && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}
      {user && <IncomingCallModal />}
      {user && activeEventId ? <MeetingRoomOverlay /> : user && <ActiveCallOverlay />}
      <ToastContainer />
    </>
  );
}
