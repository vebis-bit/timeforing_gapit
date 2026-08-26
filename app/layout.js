import "./globals.css";

export const metadata = {
  title: "GAPIT",
  description: "Poengtavle for timeføring i tide"
};

export default function RootLayout({ children }) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  );
}
