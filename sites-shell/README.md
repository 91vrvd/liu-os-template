# Liu OS Sites runtime

This directory is the production runtime for Liu OS. It serves the compiled
desktop at `/desktop/` and provides the cloud content manager:

- GitHub OAuth restricted to the configured administrator.
- Separate draft and published content in D1.
- Public content delivery through `/api/content`.
- Image and audio uploads in R2.
- Audited draft saves and publishes.

The React desktop remains in the repository root. Run `npm run build:sites`
there to rebuild the desktop and this runtime together.

Environment variables are documented in `.env.example`; production values are
managed by Sites and must not be committed.
