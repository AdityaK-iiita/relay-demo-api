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

    const firstPage = await fetch(`${baseUrl}/api/tasks?limit=1&offset=0`);
    assert.equal(firstPage.status, 200);
    assert.deepEqual(await firstPage.json(), {
      tasks: [{ id: 1, title: "Document the API", completed: false }],
      pagination: { limit: 1, offset: 0, total: 2, hasMore: true }
    });

    const secondPage = await fetch(`${baseUrl}/api/tasks?limit=1&offset=1`);
    assert.equal(secondPage.status, 200);
    assert.deepEqual(await secondPage.json(), {
      tasks: [{ id: 2, title: "Add request validation", completed: false }],
      pagination: { limit: 1, offset: 1, total: 2, hasMore: false }
    });

    const invalidLimit = await fetch(`${baseUrl}/api/tasks?limit=0`);
    assert.equal(invalidLimit.status, 400);
    assert.deepEqual(await invalidLimit.json(), {
      error: "The limit must be an integer between 1 and 100"
    });

    const invalidOffset = await fetch(`${baseUrl}/api/tasks?offset=-1`);
    assert.equal(invalidOffset.status, 400);
    assert.deepEqual(await invalidOffset.json(), {
      error: "The offset must be a non-negative integer"
    });

    const filteredPage = await fetch(`${baseUrl}/api/tasks?completed=false&limit=1&offset=0`);
    assert.equal(filteredPage.status, 200);
    assert.equal((await filteredPage.json()).pagination.total, 2);

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

    for (const invalidBody of ["null", "[]", "\"plain text\""]) {
      const invalidPayload = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: invalidBody
      });
      assert.equal(invalidPayload.status, 400);
      assert.deepEqual(await invalidPayload.json(), {
        error: "A JSON object is required"
      });
    }

    const blankTitle = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "   " })
    });
    assert.equal(blankTitle.status, 400);
    assert.deepEqual(await blankTitle.json(), {
      error: "A task title is required"
    });

    const searchResults = await fetch(`${baseUrl}/api/tasks?q=API`);
    assert.equal(searchResults.status, 200);
    assert.deepEqual((await searchResults.json()).tasks.map(task => task.id), [1]);

    const caseInsensitiveSearch = await fetch(`${baseUrl}/api/tasks?q=VALIDATION`);
    assert.equal(caseInsensitiveSearch.status, 200);
    assert.deepEqual((await caseInsensitiveSearch.json()).tasks.map(task => task.id), [2]);

    const combinedSearch = await fetch(`${baseUrl}/api/tasks?q=document&completed=false&limit=1`);
    assert.equal(combinedSearch.status, 200);
    assert.deepEqual(await combinedSearch.json(), {
      tasks: [{ id: 1, title: "Document the API", completed: false }],
      pagination: { limit: 1, offset: 0, total: 1, hasMore: false }
    });

    const duplicateTask = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "  publish api REFERENCE " })
    });
    assert.equal(duplicateTask.status, 409);
    assert.deepEqual(await duplicateTask.json(), {
      error: "A task with this title already exists"
    });

    const createdTask = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Add release notes" })
    });
    assert.equal(createdTask.status, 201);
    assert.deepEqual(await createdTask.json(), {
      task: { id: 2, title: "Add release notes", completed: false }
    });

    const oversizedBody = JSON.stringify({ title: "x".repeat(1024 * 1024) });
    const oversizedRequest = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: oversizedBody
    });
    assert.equal(oversizedRequest.status, 413);
    assert.deepEqual(await oversizedRequest.json(), {
      error: "Request body too large"
    });

    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.status, "ok");
    assert.equal(healthBody.service, "relay-demo-api");
    assert.equal(Number.isInteger(healthBody.uptimeSeconds), true);
    assert.equal(healthBody.uptimeSeconds >= 0, true);

  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
