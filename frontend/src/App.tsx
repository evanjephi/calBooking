import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import RegisterPSW from './pages/RegisterPSW'
import LandingPage from './pages/LandingPage'
import PSWApplication from './pages/PSWApplication'
import PSWApplicationSuccess from './pages/PSWApplicationSuccess'
import PSWDashboard from './pages/PSWDashboard'
import ServiceLevelSelect from './pages/ServiceLevelSelect'
import BookingLocation from './pages/BookingLocation'
import SelectPSW from './pages/SelectPSW'
import PSWProfile from './pages/PSWProfile'
import PSWBooking from './pages/PSWBooking'
import BookingSuccess from './pages/BookingSuccess'
import MyBookings from './pages/MyBookings'
import AboutUs from './pages/AboutUs'
import ContactUs from './pages/ContactUs'
import ResourceHub from './pages/ResourceHub'
import ProviderHub from './pages/ProviderHub'
import PostDetail from './pages/PostDetail'
import PublicPage from './pages/PublicPage'
import AdminRoute from './components/AdminRoute'
import AdminLayout from './components/AdminLayout'
import AccountSettings from './pages/AccountSettings'
import AccountDocuments from './pages/AccountDocuments'
import AccountTransactions from './pages/AccountTransactions'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminPosts from './pages/admin/AdminPosts'
import AdminPostEdit from './pages/admin/AdminPostEdit'
import AdminPages from './pages/admin/AdminPages'
import AdminPageEdit from './pages/admin/AdminPageEdit'
import AdminClients from './pages/admin/AdminClients'
import AdminPSWs from './pages/admin/AdminPSWs'
import AdminBookings from './pages/admin/AdminBookings'
import AdminServiceLevels from './pages/admin/AdminServiceLevels'
import AdminUsers from './pages/admin/AdminUsers'
import PublicNav from './components/PublicNav'
import Footer from './components/Footer'
import ChatWidget from './components/ChatWidget'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center-text">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function IsAdminRoute({ children }: { children: React.ReactNode }) {
  return <AdminRoute>{children}</AdminRoute>;
}

function App() {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <>
      {!isAdmin && <PublicNav />}
      <Routes>
        {/* Public landing — logged-in clients go straight to Find PSW */}
        <Route path="/" element={
          user && user.role === 'client'
            ? <Navigate to="/find-psw" replace />
            : <LandingPage />
        } />

        {/* Auth */}
        <Route path="/login" element={<div className="page-content"><Login /></div>} />
        <Route path="/register" element={<div className="page-content"><Register /></div>} />
        <Route path="/register/psw" element={<div className="page-content"><RegisterPSW /></div>} />

        {/* Public pages (full-width, handle own layout) */}
        <Route path="/about" element={<AboutUs />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/resources/clients" element={<ResourceHub />} />
        <Route path="/resources/providers" element={<ProviderHub />} />
        <Route path="/resources/:slug" element={<PostDetail />} />
        <Route path="/pages/:slug" element={<div className="page-content"><PublicPage /></div>} />

        {/* PSW Dashboard & Application flow */}
        <Route path="/dashboard" element={<PrivateRoute><div className="page-content"><PSWDashboard /></div></PrivateRoute>} />
        <Route path="/psw/apply" element={<PrivateRoute><div className="page-content"><PSWApplication /></div></PrivateRoute>} />
        <Route path="/psw/application-success" element={<PrivateRoute><div className="page-content"><PSWApplicationSuccess /></div></PrivateRoute>} />

        {/* Protected booking flow */}
        <Route path="/find-psw" element={<PrivateRoute><div className="page-content"><ServiceLevelSelect /></div></PrivateRoute>} />
        <Route path="/booking/location" element={<PrivateRoute><div className="page-content"><BookingLocation /></div></PrivateRoute>} />
        <Route path="/book/:id/results" element={<PrivateRoute><div className="page-content"><SelectPSW /></div></PrivateRoute>} />
        <Route path="/psw/:pswId/:reqId" element={<PrivateRoute><div className="page-content"><PSWProfile /></div></PrivateRoute>} />
        <Route path="/psw/:pswId/:reqId/book" element={<PrivateRoute><div className="page-content"><PSWBooking /></div></PrivateRoute>} />
        <Route path="/book/:id/success" element={<PrivateRoute><div className="page-content"><BookingSuccess /></div></PrivateRoute>} />
        <Route path="/bookings" element={<PrivateRoute><div className="page-content"><MyBookings /></div></PrivateRoute>} />

        {/* Account pages */}
        <Route path="/account" element={<PrivateRoute><div className="page-content"><AccountSettings /></div></PrivateRoute>} />
        <Route path="/account/documents" element={<PrivateRoute><div className="page-content"><AccountDocuments /></div></PrivateRoute>} />
        <Route path="/account/transactions" element={<PrivateRoute><div className="page-content"><AccountTransactions /></div></PrivateRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<IsAdminRoute><AdminLayout /></IsAdminRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="posts" element={<AdminPosts />} />
          <Route path="posts/new" element={<AdminPostEdit />} />
          <Route path="posts/:id/edit" element={<AdminPostEdit />} />
          <Route path="pages" element={<AdminPages />} />
          <Route path="pages/new" element={<AdminPageEdit />} />
          <Route path="pages/:id/edit" element={<AdminPageEdit />} />
          <Route path="clients" element={<AdminClients />} />
          <Route path="psws" element={<AdminPSWs />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="service-levels" element={<AdminServiceLevels />} />
          <Route path="users" element={<AdminUsers />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isAdmin && <Footer />}
      {!isAdmin && <ChatWidget />}
    </>
  )
}

export default App
