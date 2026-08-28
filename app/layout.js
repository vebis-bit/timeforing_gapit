// Rot-layout for hele appen. Laster global CSS og setter <html lang="no">.
// Alle sider (forsiden + /admin) rendres inne i <body>.

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
