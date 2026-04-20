import "./globals.css";
import WebSocketProvider from "../components/WebSocketProvider";
import ToastProvider from "../components/common/ToastProvider";
import ToastContainerClient from "../components/common/ToastContainerClient";
import { CustomerAddressProvider } from "../context/CustomerAddressContext";
import { StageProvider } from "../context/StageContext";
// import FCMProvider from "../components/FCMProvider";
import "react-toastify/dist/ReactToastify.css";

// Use local system fonts instead of Google Fonts
const geistSans = {
  className: "font-sans"
};

const geistMono = {
  className: "font-mono"
};

export const metadata = {
  title: "Attendance & Workforce Dashboard",
  description: "Enterprise-style Attendance & Workforce Management Dashboard UI",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.className} ${geistMono.className} antialiased bg-slate-50 text-slate-900`}
      >
        <WebSocketProvider>
          <ToastProvider>
            <CustomerAddressProvider>
              <StageProvider>
                {children}
              </StageProvider>
            </CustomerAddressProvider>
          </ToastProvider>
        </WebSocketProvider>
        <ToastContainerClient />
      </body>
    </html>
  );
}
