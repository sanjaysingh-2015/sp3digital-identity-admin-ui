# SP3 Digital Identity Admin UI

Angular administration console for the uploaded `sp3digital-identity-admin-service` Node.js backend.

## Backend contract

The UI targets:

`http://localhost:3000/api/v1/identity-admin`

This matches the uploaded backend's Express mount path.

The backend requires a bearer JWT on every Identity Admin request. There is intentionally no fake login endpoint in this UI because the backend itself does not expose a login route. The Login screen accepts an externally-issued JWT and stores it in browser local storage.

The backend expects the JWT to contain a tenant claim:

- `tenant_uuid`, or
- `tenantUuid`, or
- `tid`

It also validates `identity-admin:read` for GET/HEAD and `identity-admin:write` for mutating requests.

## Run

Use Node.js 20 LTS or newer.

The package.json pins all Angular framework packages to the same Angular 20.3 patch level to avoid npm ERESOLVE peer-dependency conflicts.

```bash
npm install
npm start
```

If you previously ran `npm install` with the old package.json, delete the old installation before installing this version:

```bash
rmdir /s /q node_modules
del package-lock.json
npm install
```

On PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json -ErrorAction SilentlyContinue
npm install
```

Open:

`http://localhost:4200`

## API base URL

Change `src/app/core/config.ts` for another environment:

```ts
export const environment = {
  apiBaseUrl: 'http://localhost:3000/api/v1/identity-admin'
};
```

## Implemented backend areas

- Users
- User sessions
- Roles
- Permissions
- Identity providers
- OAuth/OIDC clients
- API clients
- Service accounts
- Security policy
- Tenant authentication configuration
- Audit logs
- JWT context/dashboard

The implementation uses the actual route structure found in the uploaded backend repository, including:

`/users`, `/authorization/roles`, `/authorization/permissions`, `/identity-providers`, `/oauth/clients`, `/api-clients`, `/service-accounts`, `/security-policy`, `/auth-configs/:tenantUuid`, `/audit-logs`, `/users/:userId/sessions`, and the corresponding lifecycle endpoints.

## Notes

The UI deliberately does not hard-code backend response DTOs because several service methods return database model shapes. It normalizes common `data/items/rows` pagination wrappers and supports the snake_case fields used by the Sequelize models.
