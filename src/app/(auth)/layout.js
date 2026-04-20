export default function AuthLayout({ children }) {
  // Auth pages (login, register, etc.) should be accessible without authentication
  // No AuthGuard wrapper here
  return <>{children}</>;
}
