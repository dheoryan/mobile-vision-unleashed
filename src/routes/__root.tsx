import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { RealtimeBridge } from "@/lib/realtime-bridge";
import { PushPromptModal } from "@/components/mutuals/PushPromptModal";
import { PwaLifecycle } from "@/components/mutuals/PwaLifecycle";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="bg-habitat flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 font-display text-2xl font-bold text-foreground">
          Lost in the habitat.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This page doesn't exist — but your Tribe does.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { name: "theme-color", content: "#0F0F0F" },
      // iOS ignores the manifest for standalone launches; these three are what
      // give it a dark status bar and a real splash instead of a white flash.
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "MEUTUALS" },
      { name: "mobile-web-app-capable", content: "yes" },
      { title: "MEUTUALS — Your tribe is waiting" },
      {
        name: "description",
        content:
          "Connect with people who share your interests, then meet up in the real world. 21+ only.",
      },
      { property: "og:title", content: "MEUTUALS — Your tribe is waiting" },
      {
        property: "og:description",
        content:
          "Connect with people who share your interests, then meet up in the real world. 21+ only.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MEUTUALS — Your tribe is waiting" },
      {
        name: "twitter:description",
        content:
          "Connect with people who share your interests, then meet up in the real world. 21+ only.",
      },
      {
        property: "og:image",
        content: "/__l5e/assets-v1/884bca6a-a9cf-43a0-8b5e-a2f8d0f21f35/meutuals-og.png",
      },
      {
        name: "twitter:image",
        content: "/__l5e/assets-v1/884bca6a-a9cf-43a0-8b5e-a2f8d0f21f35/meutuals-og.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&family=Space+Mono:wght@400;700&display=swap",
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeBridge />
        <PwaLifecycle />
        <Outlet />
        <PushPromptModal />
        <Toaster
          position="top-center"
          theme="dark"
          offset={{ top: "calc(env(safe-area-inset-top) + 72px)" }}
          mobileOffset={{ top: "calc(env(safe-area-inset-top) + 64px)", left: 12, right: 12 }}
          richColors
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
