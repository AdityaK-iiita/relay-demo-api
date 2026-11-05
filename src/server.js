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
    return sendJson(res, 200, { tasks });
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

      if (!input.title || typeof input.title !== "string") {
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
