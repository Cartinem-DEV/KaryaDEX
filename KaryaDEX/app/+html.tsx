/**
 * KaryaDEX — Web-specific HTML template
 * 
 * Adds Inter font, viewport meta, refined desktop frame, and glassmorphism styling.
 */

import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta
          httpEquiv="Content-Security-Policy"
          content={
            process.env.NODE_ENV === 'production' && typeof __DEV__ !== 'undefined' && !__DEV__
              ? "default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com; frame-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; font-src 'self' http: https: data: https://fonts.gstatic.com; img-src 'self' data: https: blob: https://*.googleusercontent.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https:; object-src 'none'; base-uri 'self'; form-action 'self';"
              : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com; frame-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; font-src 'self' http: https: data: https://fonts.gstatic.com; img-src 'self' data: https: blob: https://*.googleusercontent.com; connect-src 'self' ws: wss: http: https:; object-src 'none'; base-uri 'self'; form-action 'self';"
          }
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0B0C11" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <title>KaryaDEX — Plan. Focus. Progress.</title>
        <meta name="description" content="KaryaDEX is the connected workspace for planning, learning, and getting things done. Track schedules, attendance margins, tasks, and syllabus progress." />

        {/* Google Fonts: Inter, Isometra, Honk, Montserrat, Oswald */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Honk&family=Inter:wght@400;500;600;700;800&family=Isometra:wght@400;700;800&family=Montserrat:wght@400;600;700;800;900&family=Oswald:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />

        {/* Google Identity Services SDK for Direct App Authentication */}
        <script src="https://accounts.google.com/gsi/client" async defer></script>

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: `
          @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap');
          * {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            box-sizing: border-box;
          }
          html, body, #root {
            height: 100%;
            margin: 0;
            padding: 0;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          body {
            overflow: hidden;
            background-color: #05070B;
          }
          @media (prefers-color-scheme: dark) {
            body {
              background-color: #05070B;
            }
          }
          /* Centered mobile-first container on tablet/desktop */
          #root > div {
            max-width: 480px;
            margin: 0 auto;
            height: 100%;
            position: relative;
            background-color: #05070B;
          }
          @media (min-width: 768px) {
            body {
              background: radial-gradient(circle at 50% 30%, rgba(0, 225, 255, 0.05) 0%, rgba(245, 158, 11, 0.04) 40%, transparent 70%), #030508;
            }
            @media (prefers-color-scheme: dark) {
              body {
                background: radial-gradient(circle at 50% 30%, rgba(0, 225, 255, 0.06) 0%, rgba(245, 158, 11, 0.05) 40%, transparent 70%), #020306;
              }
            }
            #root > div {
              max-width: 440px;
              box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.06);
            }
          }
          @media (min-width: 1024px) {
            #root > div {
              max-width: 420px;
            }
          }
          /* Google Identity Services Invisible Overlay */
          #gsi-client-overlay {
            cursor: pointer !important;
          }
          #gsi-client-overlay iframe {
            width: 100% !important;
            height: 100% !important;
            cursor: pointer !important;
          }
          /* Custom sleek scrollbars */
          * {
            scrollbar-width: thin;
            scrollbar-color: rgba(124, 58, 237, 0.15) transparent;
          }
          ::-webkit-scrollbar {
            width: 4px;
          }
          ::-webkit-scrollbar-thumb {
            background: rgba(124, 58, 237, 0.20);
            border-radius: 2px;
          }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
