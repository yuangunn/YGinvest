<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Deploy workflow

After every `git push origin master`, ALWAYS run `vercel --prod --yes` from `apps/web/` to trigger an explicit Vercel production deployment. The GitHub-Vercel auto-deploy is unreliable in timing, so the explicit CLI trigger is required — not optional.

Standard end-of-task sequence:
1. `git push origin master`
2. `cd apps/web && vercel --prod --yes`
3. Report the production URL back to the user.
