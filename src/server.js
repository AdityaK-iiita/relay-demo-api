const http = require("node:http");

const tasks = [
  { id: 1, title: "Document the API", completed: false },
  { id: 2, title: "Add request validation", completed: false }
];

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { status: "ok" });
  }

  if (req.method === "GET" && url.pathname === "/api/tasks") {
    const completed = url.searchParams.get("completed");

    if (completed !== null && completed !== "true" && completed !== "false") {
      return sendJson(res, 400, { error: "The completed filter must be true or false" });
    }

    const filteredTasks = completed === null
      ? tasks
      : tasks.filter(task => task.completed === (completed === "true"));

    return sendJson(res, 200, { tasks: filteredTasks });
  }

  if (req.method === "DELETE" && /^\/api\/tasks\/\d+$/.test(url.pathname)) {
    const id = Number(url.pathname.split("/").pop());
    const taskIndex = tasks.findIndex(item => item.id === id);

    if (taskIndex === -1) {
      return sendJson(res, 404, { error: "Task not found" });
    }

    const [deletedTask] = tasks.splice(taskIndex, 1);
    return sendJson(res, 200, { task: deletedTask });
  }

  if (req.method === "PATCH" && /^\/api\/tasks\/\d+$/.test(url.pathname)) {
    const id = Number(url.pathname.split("/").pop());
    const task = tasks.find(item => item.id === id);

    if (!task) {
      return sendJson(res, 404, { error: "Task not found" });
    }

    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {
      let input;

      try {
        input = JSON.parse(body);
      } catch {
        return sendJson(res, 400, { error: "Invalid JSON" });
      }

      if (!input || typeof input !== "object" || Array.isArray(input)) {
        return sendJson(res, 400, { error: "A JSON object is required" });
      }

      const hasTitle = Object.prototype.hasOwnProperty.call(input, "title");
      const hasCompleted = Object.prototype.hasOwnProperty.call(input, "completed");

      if (!hasTitle && !hasCompleted) {
        return sendJson(res, 400, { error: "At least one supported field is required" });
      }

      if (hasTitle && (typeof input.title !== "string" || !input.title.trim())) {
        return sendJson(res, 400, { error: "The title must be a non-empty string" });
      }

      if (hasCompleted && typeof input.completed !== "boolean") {
        return sendJson(res, 400, { error: "The completed field must be a boolean" });
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
      return sendJson(res, 404, { error: "Task not found" });
    }

    return sendJson(res, 200, { task });
  }

  if (req.method === "POST" && url.pathname === "/api/tasks") {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {
      let input;

      try {
        input = JSON.parse(body);
      } catch {
        return sendJson(res, 400, { error: "Invalid JSON" });
      }

      if (!input.title || typeof input.title !== "string" || !input.title.trim()) {
        return sendJson(res, 400, { error: "A task title is required" });
      }

      const task = {
        id: tasks.length + 1,
        title: input.title.trim(),
        completed: false
      };

      tasks.push(task);
      return sendJson(res, 201, { task });
    });

    return;
  }

  return sendJson(res, 404, { error: "Route not found" });
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Relay demo API listening on port ${port}`);
  });
}

module.exports = { server };
