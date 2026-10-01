import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import PaperShell from "./components/PaperShell";
import About from "./pages/About";
import AdminUsers from "./pages/AdminUsers";
import AvatarSettings from "./pages/AvatarSettings";
import ChangePassword from "./pages/ChangePassword";
import Category, { StaticCategory } from "./pages/Category";
import Contact from "./pages/Contact";
import Home from "./pages/Home";
import MyPosts from "./pages/MyPosts";
import NewsDrafts from "./pages/NewsDrafts";
import PostDetail from "./pages/PostDetail";
import SystemNotices from "./pages/SystemNotices";
import Register from "./pages/Register";
import Terms from "./pages/Terms";
import ResetPassword from "./pages/ResetPassword";
import SignIn from "./pages/SignIn";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PaperShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/news/drafts" element={<NewsDrafts />} />
            <Route path="/news" element={<Navigate to="/" replace />} />
            <Route path="/sports" element={<Navigate to="/" replace />} />
            <Route path="/forum" element={<Category category="forum" title="Forum" />} />
            <Route path="/opinion" element={<StaticCategory title="Opinion" />} />
            <Route path="/community" element={<Navigate to="/forum" replace />} />
            <Route path="/submit" element={<Navigate to="/forum" replace />} />
            <Route path="/dorm-life" element={<Navigate to="/" replace />} />
            <Route path="/events" element={<Navigate to="/" replace />} />
            <Route path="/photo" element={<Navigate to="/" replace />} />
            <Route path="/posts/:postId" element={<PostDetail />} />
            <Route path="/me/posts" element={<MyPosts />} />
            <Route path="/me/avatar" element={<AvatarSettings />} />
            <Route path="/me/password" element={<ChangePassword />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/paper" element={<Navigate to="/" replace />} />
            <Route path="/system" element={<SystemNotices />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/about" element={<About />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
