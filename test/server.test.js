const test = require("node:test");
const assert = require("node:assert/strict");
const { server } = require("../src/server");

test("health endpoint returns ok", async () => {
  await new Promise(resolve => server.listen(0, resolve));

  try {
    const response = await fetch(`http://localhost:${server.address().port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
