import "./globals.css";
import type { Metadata } from "next";
import AppShell from "../components/appShell";
import { AuthProvider } from "../contexts/authContext";

export const metadata: Metadata = {
  title: { default: "JLG LOGISTICS WAREHOUSE", template: "%s | JLG LOGISTICS WAREHOUSE" },
  description: "Sistema de recepción, almacenaje y despacho de carga con manifiesto aduanal.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <AuthProvider><AppShell>{children}</AppShell></AuthProvider>
      </body>
    </html>
  );
}
