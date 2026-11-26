export const metadata = {
  title: "FirstShot",
  description: "FirstShot Next.js app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
