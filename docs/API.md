# SmartLibrary API Documentation

Current serverless routes:

## POST /api/ingest
Fetches and extracts readable text from a link.

Request:

- `url`: string

Response:

- `title`
- `text`
- `source`
- `wordCount`

## POST /api/transform
Generates SmartLibrary outputs from retrieved source excerpts.

Request:

- `action`
- `question`
- `sources`
- `libraryMeta`

AI routing environment variables:

- `SMARTLIBRARY_AI_PROVIDER=auto|groq|openrouter|gemini|openai`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_SITE_URL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## POST /api/webhooks
Receives or simulates SmartLibrary automation events.

Events:

- `audio_uploaded`
- `transcript_processed`
- `course_created`
- `lesson_completed`
- `quiz_passed`
- `assignment_submitted`
- `certificate_issued`
