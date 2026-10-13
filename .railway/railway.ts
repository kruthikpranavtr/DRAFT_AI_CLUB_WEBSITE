import { defineRailway, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "ai-club-cms";
export default defineRailway(() => {
  const aiClubCms = service("ai-club-cms", {
    // builder from CaC: "NIXPACKS"
    build: "npm ci && npm run build",
    start: "npm start",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    replicas: { "iad": 1 },
  });

  return project("DRAFT_AI_CLUB_WEBSITE", {
    variables: { managed: false },
    resources: [aiClubCms],
  });
});
