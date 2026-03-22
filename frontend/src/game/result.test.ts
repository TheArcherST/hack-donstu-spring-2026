import assert from "node:assert/strict";
import test from "node:test";

import { calculateDeliveryRate, calculatePacketLoss } from "./result.ts";

test("delivery rate is based on delivered packets over total packet volume", () => {
  assert.equal(calculateDeliveryRate(0, 0), 0);
  assert.equal(calculateDeliveryRate(8, 2), 80);
  assert.equal(calculateDeliveryRate(17, 3), 85);
});

test("packet loss is based on dropped packets over total packet volume", () => {
  assert.equal(calculatePacketLoss(0, 0), 0);
  assert.equal(calculatePacketLoss(8, 2), 20);
  assert.equal(calculatePacketLoss(17, 3), 15);
});
