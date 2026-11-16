# Seasonalytics

This site sends audience measurements to the shared self-hosted Umami instance at https://mc-seasonalytics.netlify.app.

- Website: Speech-to-text — démo et documentation
- Website ID: `5953ea05-8be1-4f1b-aa6f-254b3c523d34`
- Allowed production hosts: matteogiaquinto.github.io
- Tracks page views, history navigation, browser/device/location aggregates and Web Vitals when supported.
- Respects Do Not Track; URL query strings and fragments are excluded.
- No persistent identification, form contents, recordings or error payloads are enabled.
- Existing analytics integrations are preserved. A historical Umami tracker can keep its window.umami API; the additional tracker independently collects for the website ID above.
- Public tracking identifiers are not credentials. Database credentials belong only to the separate Umami application's server environment.

The tracker loads with defer. Each full document initializes it once; Umami follows pushState/replaceState for SPA and Barba navigation. Preview/local hostnames do not collect because they are absent from the allowed-host list.

This configuration does not by itself determine consent or legal compliance. Keep the site's privacy information accurate for all analytics providers still present.

## Deployment and verification

Deploy the repository through its existing hosting pipeline. Confirm the live document includes the expected website ID, its Content Security Policy permits the exact analytics origin, and a browser visit appears in the shared dashboard. Before removing the integration, remove its script entry and, where applicable, the intranet sanitizing callback. Existing analytics can remain in place.
