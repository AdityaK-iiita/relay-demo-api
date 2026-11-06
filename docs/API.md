# Relay Demo API

A small Node.js HTTP API used to demonstrate Relay issue tracking, pull requests, automated tests, and CI workflows.

## Run locally

Requires Node.js 20 or newer.

```bash
npm test
npm start
```

The server listens on port `3000` by default. Set `PORT` to use another port. Task data is held in memory and resets when the process restarts.

## Responses and request tracing

All responses use JSON. Each response includes an `X-Request-Id` header containing a UUID. The server emits one JSON log record when a response finishes, including the request ID, method, path, status code, and duration.

## Endpoints

### Health

`GET /health`

Returns service health and process uptime.

Example:

```json
{
  "status": "ok",
  "service": "relay-demo-api",
  "uptimeSeconds": 42
}
```

### List, filter, search, and paginate tasks

`GET /api/tasks`

Optional query parameters:

| Parameter | Description |
| --- | --- |
| `completed` | Filter by completion state: `true` or `false` |
| `q` | Case-insensitive substring search in task titles |
| `limit` | Page size, integer from 1 to 100 |
| `offset` | Number of matching tasks to skip, non-negative integer |

Examples:

```bash
curl "http://localhost:3000/api/tasks"
curl "http://localhost:3000/api/tasks?completed=false"
curl "http://localhost:3000/api/tasks?q=api"
curl "http://localhost:3000/api/tasks?completed=false&q=api&limit=10&offset=0"
```

When neither `limit` nor `offset` is supplied, the response is `{ "tasks": [...] }`. When pagination is requested, the response also contains:

```json
{
  "tasks": [],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 0,
    "hasMore": false
  }
}
```

### Get one task

`GET /api/tasks/:id`

Returns the task or a `404` error if the ID does not exist.

### Create a task

`POST /api/tasks`

Request body:

```json
{
  "title": "Write integration tests"
}
```

A successful request returns `201 Created`. Titles must be non-empty strings. A case-insensitive duplicate title returns `409 Conflict`.

### Update a task

`PATCH /api/tasks/:id`

Send one or both supported fields:

```json
{
  "title": "Update API reference",
  "completed": true
}
```

A title must be a non-empty string, and `completed` must be a boolean. Fields omitted from the request remain unchanged.

### Delete a task

`DELETE /api/tasks/:id`

Returns the deleted task. Unknown IDs return `404`.

## Error responses

Errors include a human-readable `error` message and a stable machine-readable `code`.

Example:

```json
{
  "error": "Task not found",
  "code": "TASK_NOT_FOUND"
}
```

Common status codes:

| Status | Meaning |
| --- | --- |
| `400` | Invalid JSON, payload, or query parameter |
| `404` | Unknown route or task ID |
| `409` | Duplicate task title |
| `413` | Request body exceeds 1 MiB |

## Tests

Run the integration suite with:

```bash
npm test
```

GitHub Actions runs the test suite for pushes and pull requests.
