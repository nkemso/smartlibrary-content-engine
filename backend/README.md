# SmartLibrary Backend Blueprint

This folder documents the production backend modules for the SaaS learning platform layer. The current deployed Whop app uses Vercel serverless API routes in `/api`, while this backend blueprint is ready to be expanded into a dedicated Node/Express/PostgreSQL service.

Modules:

- `routes/` HTTP route contracts
- `models/` data model contracts
- `services/` domain services
- `webhooks/` event dispatching
- `ai/` multi-agent AI providers

Production targets:

- JWT auth and Google OAuth
- Role-based access control
- PostgreSQL schema in `database/schema.sql`
- S3-compatible storage
- Webhooks for audio_uploaded, transcript_processed, course_created, lesson_completed, quiz_passed, assignment_submitted
- WebSockets for AI tutor/community realtime events
