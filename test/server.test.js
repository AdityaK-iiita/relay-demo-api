const test = require("node:test");
const assert = require("node:assert/strict");
const { server } = require("../src/server");

test("task endpoints return a task by ID or 404 and filter by completion", async () => {
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

    const incomplete = await fetch(`${baseUrl}/api/tasks?completed=false`);
    assert.equal(incomplete.status, 200);
    assert.equal((await incomplete.json()).tasks.length, 2);

    const complete = await fetch(`${baseUrl}/api/tasks?completed=true`);
    assert.equal(complete.status, 200);
    assert.deepEqual((await complete.json()).tasks, []);

    const invalid = await fetch(`${baseUrl}/api/tasks?completed=yes`);
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), {
      error: "The completed filter must be true or false"
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
