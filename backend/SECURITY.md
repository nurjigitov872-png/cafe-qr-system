# API access rules

Public: POST /api/auth/login, GET /api/products, GET /api/products/:id, POST /api/orders, POST /api/waiter-calls, GET /.

Admin JWT required: GET /api/auth/me, GET /api/orders, GET /api/orders/dashboard/stats, GET /api/waiter-calls, POST/PUT/DELETE /api/products[/:id], PATCH /api/orders/:id/status, PATCH /api/waiter-calls/:id/done.

Order owner JWT or admin JWT required: GET /api/orders/:id, PATCH /api/orders/:id/cancel. Cancellation matches pending orders atomically. POST /api/orders returns orderToken; the frontend stores it per order and sends it as a Bearer token. Customer tokens grant no admin permissions. Tokens are never placed in URLs.

JWT signatures use HS256 with fixed issuer/audience, a seven-day expiry, and a server-assigned role. Admin subject must match ADMIN_USERNAME. JWT_SECRET is mandatory; there is no default secret. Missing/invalid/expired tokens yield 401, and authenticated users without permission yield 403. Socket.IO also requires an admin token and disconnects when the token expires.

Deployment: deploy backend and frontend together. Existing admins must log in again. Old order links without an owner token are intentionally no longer public; admins can still access those orders. No database migration is needed and no historical data is changed. Rotating JWT_SECRET invalidates both admin and customer tokens.

Tests: cd backend, then npm test. Tests use random temporary credentials, mock models and a stub Telegram notifier. They never load .env or connect to MongoDB/Telegram. No real records are created, edited or deleted.
