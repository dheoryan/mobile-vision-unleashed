import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Refetching every query on every window focus replayed the whole
        // page-load request set each time the user tabbed back. Realtime
        // already covers the surfaces that need to be live.
        refetchOnWindowFocus: false,
        // 3 retries turned a single outage into 4x the load, with a long
        // delay before the UI could show an error state.
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
