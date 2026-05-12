"use client";

/**
 * Sanity Studio config — embedded into the Next.js app via the route at
 * `app/studio/[[...tool]]/page.tsx`. Visit /studio in the running app
 * and you get the full Studio UI under the same domain.
 */

import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { apiVersion, dataset, projectId } from "./src/sanity/env";
import { schema } from "./src/sanity/schemaTypes";
import { structure } from "./src/sanity/structure";

export default defineConfig({
  basePath: "/studio",
  projectId,
  dataset,
  schema,
  plugins: [
    structureTool({ structure }),
    // Vision = GROQ query playground. Devs only — handy for debugging
    // queries without leaving Studio.
    visionTool({ defaultApiVersion: apiVersion }),
  ],
});
