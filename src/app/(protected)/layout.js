import AuthGuard from "../../components/auth/AuthGuard";

export default function ProtectedLayout({ children }) {
  // All protected routes must have valid authentication
  return <AuthGuard>{children}</AuthGuard>;
}
