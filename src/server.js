const http = require("node:http");
const { randomUUID } = require("node:crypto");

const tasks = [
  { id: 1, title: "Document the API", completed: false },
  { id: 2, title: "Add request validation", completed: false }
];
let nextTaskId = Math.max(...tasks.map(task => task.id)) + 1;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, code, message) {
  return sendJson(res, statusCode, { error: message, code });
}

const MAX_BODY_BYTES = 1024 * 1024;

function readJsonBody(req, res, onParsed) {
  let body = "";
  let tooLarge = false;

  req.on("data", chunk => {
    if (tooLarge) return;

    body += chunk;

    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      tooLarge = true;
      return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
    }
  });

  req.on("end", () => {
    if (tooLarge) return;

    try {
      onParsed(JSON.parse(body));
    } catch {
      sendError(res, 400, "INVALID_JSON", "Invalid JSON");
    }
  });
}

const server = http.createServer((req, res) => {
  const requestId = randomUUID();
  const startedAt = process.hrtime.bigint();
  res.setHeader("X-Request-Id", requestId);
  const url = new URL(req.url, `http://${req.headers.host}`);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    console.log(JSON.stringify({
      level: "info",
      message: "request completed",
      requestId,
      method: req.method,
      path: url.pathname,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100
    }));
  });

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, {
      status: "ok",
      service: "relay-demo-api",
      uptimeSeconds: Math.floor(process.uptime())
    });
  }

  if (req.method === "GET" && url.pathname === "/api/tasks") {
    const completed = url.searchParams.get("completed");

    if (completed !== null && completed !== "true" && completed !== "false") {
      return sendError(res, 400, "INVALID_COMPLETED_FILTER", "The completed filter must be true or false");
    }

    const statusFilteredTasks = completed === null
      ? tasks
      : tasks.filter(task => task.completed === (completed === "true"));
    const searchTerm = url.searchParams.get("q");
    const matchingTasks = searchTerm === null || !searchTerm.trim()
      ? statusFilteredTasks
      : statusFilteredTasks.filter(task =>
        task.title.toLowerCase().includes(searchTerm.trim().toLowerCase())
      );

    const hasPagination = url.searchParams.has("limit") || url.searchParams.has("offset");

    if (!hasPagination) {
      return sendJson(res, 200, { tasks: matchingTasks });
    }

    const rawLimit = url.searchParams.get("limit");
    const rawOffset = url.searchParams.get("offset");
    const limit = rawLimit === null ? 20 : Number(rawLimit);
    const offset = rawOffset === null ? 0 : Number(rawOffset);

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return sendError(res, 400, "INVALID_LIMIT", "The limit must be an integer between 1 and 100");
    }

    if (!Number.isInteger(offset) || offset < 0) {
      return sendError(res, 400, "INVALID_OFFSET", "The offset must be a non-negative integer");
    }

    const page = matchingTasks.slice(offset, offset + limit);

    return sendJson(res, 200, {
      tasks: page,
      pagination: {
        limit,
        offset,
        total: matchingTasks.length,
        hasMore: offset + page.length < matchingTasks.length
      }
    });
  }

  if (req.method === "DELETE" && /^\/api\/tasks\/\d+$/.test(url.pathname)) {
    const id = Number(url.pathname.split("/").pop());
    const taskIndex = tasks.findIndex(item => item.id === id);

    if (taskIndex === -1) {
      return sendError(res, 404, "TASK_NOT_FOUND", "Task not found");
    }

    const [deletedTask] = tasks.splice(taskIndex, 1);
    return sendJson(res, 200, { task: deletedTask });
  }

  if (req.method === "PATCH" && /^\/api\/tasks\/\d+$/.test(url.pathname)) {
    const id = Number(url.pathname.split("/").pop());
    const task = tasks.find(item => item.id === id);

    if (!task) {
      return sendError(res, 404, "TASK_NOT_FOUND", "Task not found");
    }

    readJsonBody(req, res, input => {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        return sendError(res, 400, "INVALID_BODY", "A JSON object is required");
      }

      const hasTitle = Object.prototype.hasOwnProperty.call(input, "title");
      const hasCompleted = Object.prototype.hasOwnProperty.call(input, "completed");

      if (!hasTitle && !hasCompleted) {
        return sendError(res, 400, "EMPTY_UPDATE", "At least one supported field is required");
      }

      if (hasTitle && (typeof input.title !== "string" || !input.title.trim())) {
        return sendError(res, 400, "INVALID_TITLE", "The title must be a non-empty string");
      }

      if (hasCompleted && typeof input.completed !== "boolean") {
        return sendError(res, 400, "INVALID_COMPLETED", "The completed field must be a boolean");
      }

      if (hasTitle) task.title = input.title.trim();
      if (hasCompleted) task.completed = input.completed;

      return sendJson(res, 200, { task });
    });

    return;
  }

  if (req.method === "GET" && /^\/api\/tasks\/\d+$/.test(url.pathname)) {
    const id = Number(url.pathname.split("/").pop());
    const task = tasks.find(item => item.id === id);

    if (!task) {
      return sendError(res, 404, "TASK_NOT_FOUND", "Task not found");
    }

    return sendJson(res, 200, { task });
  }

  if (req.method === "POST" && url.pathname === "/api/tasks") {
    readJsonBody(req, res, input => {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        return sendError(res, 400, "INVALID_BODY", "A JSON object is required");
      }

      if (typeof input.title !== "string" || !input.title.trim()) {
        return sendError(res, 400, "INVALID_TITLE", "A task title is required");
      }

      const normalizedTitle = input.title.trim().toLowerCase();
      const duplicate = tasks.some(task => task.title.toLowerCase() === normalizedTitle);

      if (duplicate) {
        return sendError(res, 409, "DUPLICATE_TASK", "A task with this title already exists");
      }

      const task = {
        id: nextTaskId++,
        title: input.title.trim(),
        completed: false
      };

      tasks.push(task);
      return sendJson(res, 201, { task });
    });

    return;
  }

  return sendError(res, 404, "ROUTE_NOT_FOUND", "Route not found");
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Relay demo API listening on port ${port}`);
  });
}

module.exports = { server };
