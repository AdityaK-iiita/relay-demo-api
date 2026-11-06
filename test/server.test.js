const test = require("node:test");
const assert = require("node:assert/strict");
const { server } = require("../src/server");

test("task endpoints support lookup, completion filtering, and completion updates", async () => {
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

    const invalidFilter = await fetch(`${baseUrl}/api/tasks?completed=yes`);
    assert.equal(invalidFilter.status, 400);
    assert.deepEqual(await invalidFilter.json(), {
      error: "The completed filter must be true or false"
    });

    const updated = await fetch(`${baseUrl}/api/tasks/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true })
    });
    assert.equal(updated.status, 200);
    assert.deepEqual(await updated.json(), {
      task: { id: 1, title: "Document the API", completed: true }
    });

    const completedTasks = await fetch(`${baseUrl}/api/tasks?completed=true`);
    assert.deepEqual((await completedTasks.json()).tasks.map(task => task.id), [1]);

    const invalidUpdate = await fetch(`${baseUrl}/api/tasks/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: "yes" })
    });
    assert.equal(invalidUpdate.status, 400);
    assert.deepEqual(await invalidUpdate.json(), {
      error: "The completed field must be a boolean"
    });

    const missingUpdate = await fetch(`${baseUrl}/api/tasks/999`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true })
    });
    assert.equal(missingUpdate.status, 404);
    const renamed = await fetch(`${baseUrl}/api/tasks/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Publish API reference" })
    });
    assert.equal(renamed.status, 200);
    assert.deepEqual(await renamed.json(), {
      task: { id: 1, title: "Publish API reference", completed: true }
    });

    const emptyTitle = await fetch(`${baseUrl}/api/tasks/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "   " })
    });
    assert.equal(emptyTitle.status, 400);
    assert.deepEqual(await emptyTitle.json(), {
      error: "The title must be a non-empty string"
    });

    const emptyPatch = await fetch(`${baseUrl}/api/tasks/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(emptyPatch.status, 400);
    assert.deepEqual(await emptyPatch.json(), {
      error: "At least one supported field is required"
    });

    const deleted = await fetch(`${baseUrl}/api/tasks/2`, { method: "DELETE" });
    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), {
      task: { id: 2, title: "Add request validation", completed: false }
    });

    const deletedLookup = await fetch(`${baseUrl}/api/tasks/2`);
    assert.equal(deletedLookup.status, 404);
    assert.deepEqual(await deletedLookup.json(), { error: "Task not found" });

    const deleteMissing = await fetch(`${baseUrl}/api/tasks/999`, { method: "DELETE" });
    assert.equal(deleteMissing.status, 404);
    assert.deepEqual(await deleteMissing.json(), { error: "Task not found" });

  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
