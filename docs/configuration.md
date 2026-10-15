# Configuration

`LightView` is configured with Vite environment variables. The dev server reads `.env.development` and production builds read `.env.production`; sample files for both are in the repository root.

| Variable                  | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `VITE_SERVICE_URL`        | URL of the lightserve backend                    |
| `VITE_AUTH_ENABLED`       | Enables login/logout                             |
| `VITE_LOGIN_SERVICE`      | Login service URL                                |
| `VITE_LOGOUT_SERVICE`     | Logout service URL                               |
| `VITE_CROSSMATCH_ENABLED` | Enables the [Cross Matcher](cross-matching.md)   |
| `VITE_ORGANIZATION_NAME`  | Organization name shown in the navbar (optional) |
| `VITE_APP_NAME`           | App name shown in the navbar                     |
| `VITE_APP_TITLE`          | Title shown in the browser tab                   |
| `VITE_CONTACT_EMAIL`      | Contact email shown in the footer                |
