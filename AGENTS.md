# AGENTS.md

## Publishing to npm

This package is published publicly as `@matteogiaquinto/speech-to-text` under the npm organization scope `@matteogiaquinto`.

The version `0.1.0` has already been published to npm. npm package versions are immutable: **never attempt to publish an already-published version again**.

Before any future npm release:

1. Make sure the working tree is clean and all checks pass.
2. Check the currently published version:
   ```powershell
   npm view @matteogiaquinto/speech-to-text version
   ```
3. Bump the package version before publishing. For a normal bugfix:
   ```powershell
   npm version patch
   ```
   This changes `0.1.0` to `0.1.1`, then `0.1.2`, etc.
4. Publish the new version:
   ```powershell
   npm publish --access public
   ```
5. Push the version commit/tag created by `npm version`:
   ```powershell
   git push --follow-tags
   ```

Use `npm version minor` or `npm version major` only when the release semantics justify it.

Publishing requires authentication for the npm organization and npm's required 2FA/security-key flow. Do not change the package scope to work around an authentication or permission error.
