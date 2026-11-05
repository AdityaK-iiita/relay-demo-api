const test = require("node:test");
const assert = require("node:assert/strict");
const { server } = require("../src/server");

test("task endpoints return a task by ID or 404", async () => {
  await new Promise(resolve => server.listen(0, resolve));

  try {
    const baseUrl = `http://localhost:${server.address().port}`;

    const found = await fetch(`${baseUrl}/api/tasks/1`);
    assert.equal(found.status, 200);
    assert.deepEqual(await found.json(), {
      task: { id: 1, title: "Document the API", completed: false }
    });

    const missing = await fetch(`${baseUrl}/api/tasks/999`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "Task not found" });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
