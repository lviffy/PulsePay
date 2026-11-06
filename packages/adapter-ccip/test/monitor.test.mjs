import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CCIPMessageMonitor } from '../dist/index.js';
const id = `0x${'ab'.repeat(32)}`;
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
test('only real bytes32 message IDs are accepted', async () => {
  await assert.rejects(new CCIPMessageMonitor().getStatus('0xSampleTxHash'), /bytes32/);
});
test('indexing delay and source confirmation never mean delivery', async () => {
  const monitor = new CCIPMessageMonitor(async () => reply({}, 404));
  assert.equal((await monitor.getStatus(id)).status, 'NOT_INDEXED');
  const pending = new CCIPMessageMonitor(async () => reply({ status: 'PENDING' }));
  assert.equal((await pending.getStatus(id)).destinationTransactionHash, null);
});
test('polling follows indexing, pending and successful destination execution', async () => {
  const responses = [reply({}, 404), reply({ status: 'PENDING' }), reply({ status: 'SUCCESS', receiptTransactionHash: id })];
  const monitor = new CCIPMessageMonitor(async () => responses.shift());
  const result = await monitor.waitForDelivery(id, { intervalMs: 1 });
  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.destinationTransactionHash, id);
});
test('failures, outages, malformed replies and cancellation remain visible', async () => {
  assert.equal((await new CCIPMessageMonitor(async () => reply({ status: 'FAILED' })).waitForDelivery(id)).status, 'FAILED');
  await assert.rejects(new CCIPMessageMonitor(async () => reply({}, 503)).getStatus(id), /503/);
  await assert.rejects(new CCIPMessageMonitor(async () => reply({})).getStatus(id), /Invalid/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(new CCIPMessageMonitor().waitForDelivery(id, { signal: controller.signal }), /abort/i);
});
