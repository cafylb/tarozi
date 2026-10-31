# GitHub deployment

The default branch is `codex/tarozi-studio`. The Pages workflow builds and checks the frontend, then publishes only `index.html`, `favicon.svg`, and `.nojekyll`. Backend source, SQL, environment files, and account data are never included in the Pages artifact.

A repository administrator must select **Settings > Pages > Build and deployment > Source > GitHub Actions** once. The connected GitHub account has write access but no administrator access, so it cannot enable Pages. After enabling it, rerun the Pages workflow if the first deployment failed.

The Pages site is a static frontend demonstration using synthetic catalog data. It does not run the Node server: email/Google login, profile persistence, and server assistant endpoints are unavailable. The separate Fastify API is not connected to this frontend yet. GitHub Pages cannot host that API or the Supabase database.

To run the full stack, provision the Supabase schema under `backend/supabase/migrations`, host `backend/Dockerfile` on a Node/container service, configure `backend/.env.example` values in that host, and complete the frontend integration described in `backend/docs/API.md`. Never store cloud credentials in GitHub source.
