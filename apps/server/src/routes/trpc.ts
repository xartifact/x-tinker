import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "../trpc/router.js";

export const trpcRouter = new Hono();

trpcRouter.use(
  "/*",
  trpcServer({
    router: appRouter,
    createContext: () => ({}),
  })
);