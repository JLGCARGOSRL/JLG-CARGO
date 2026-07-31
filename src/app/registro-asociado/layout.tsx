import type { Metadata } from "next";

const productionUrl =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  process.env.VERCEL_URL ||
  "jlg-cargo-net.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${productionUrl}`),
  title: "Registro de Asociado de Negocio",
  description:
    "Complete de forma segura el formulario de registro de asociado de negocio de JLG Cargo.",
  openGraph: {
    title: "Registro de Asociado de Negocio | JLG Cargo",
    description: "Complete su formulario de manera segura.",
    type: "website",
    locale: "es_DO",
    images: [
      {
        url: "/og-registro-asociado.png",
        width: 1731,
        height: 909,
        alt: "Registro de Asociado de Negocio de JLG Cargo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Registro de Asociado de Negocio | JLG Cargo",
    description: "Complete su formulario de manera segura.",
    images: ["/og-registro-asociado.png"],
  },
};

export default function BusinessAssociateRegistrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
