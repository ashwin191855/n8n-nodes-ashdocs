# Publishing n8n-nodes-ashdocs

n8n verifies a community node only if it was published to npm from a GitHub Actions workflow with a
provenance statement, from a public GitHub repository whose URL matches `repository.url` in
`package.json` ([n8n: Submit community nodes](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/),
[n8n: Verification guidelines](https://docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/)).
`.github/workflows/publish.yml` does that when a GitHub release is published.

## Check locally (uploads nothing)

```bash
npm ci
npm run build
npm run lint
npm test
npm pack --dry-run      # lists the 17 files that would ship
```

`npm publish` from a laptop fails on purpose: the `prepublishOnly` guard (`n8n-node prerelease`) only
lets the publish workflow through. A package published from a laptop has no provenance and n8n will not
verify it.

## One-time setup

1. Public GitHub repository `ashwin191855/n8n-nodes-ashdocs`, containing this folder at its root.
2. npm account with two-factor authentication on.
3. Granular npm access token with **Read and write (publish and stage)** permission and **Bypass
   two-factor authentication** ticked, saved as the `NPM_TOKEN` Actions secret of the repository.

## Release

1. Set `version` in `package.json` and add a section to `CHANGELOG.md`. Commit and push to `main`.
2. On GitHub, **Releases → Draft a new release**, tag `v<version>` (for example `v1.0.0`) on `main`,
   then **Publish release**.
3. The **Publish** workflow checks that the tag matches `package.json`, runs `npm ci`, build, lint and
   test, then runs `npm publish --provenance --access public`.

## After the first publish (recommended)

Switch to npm trusted publishing so no long-lived token is stored: on npmjs.com open the package →
**Settings** → **Trusted Publisher** → **GitHub Actions**, enter `ashwin191855`, `n8n-nodes-ashdocs`,
`publish.yml`, save, then delete the `NPM_TOKEN` secret and the token. Trusted publishing needs npm CLI
11.5.1 or later and Node 22.14.0 or later, which `lts/*` provides
([npm: Trusted publishing](https://docs.npmjs.com/trusted-publishers)).

## Verification

Submit on the n8n Creator Portal: https://creators.n8n.io/nodes. Before submitting, the n8n scanner
should pass:

```bash
npx @n8n/scan-community-package n8n-nodes-ashdocs
```
