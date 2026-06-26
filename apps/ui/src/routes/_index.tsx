import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { Layout } from "../components/layout";
import { ConfigPage } from "../pages/config";
import { FixesPage } from "../pages/fixes";

const rootRoute = createRootRoute({
  component: Layout,
});

const configRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ConfigPage,
});

const fixesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/fixes",
  component: FixesPage,
});

const routeTree = rootRoute.addChildren([configRoute, fixesRoute]);

const router = createRouter({ routeTree });

export { router, routeTree, rootRoute, configRoute, fixesRoute };
