import assert from "node:assert/strict";
import test from "node:test";

import { calculateDeliveryRate, calculatePacketLoss, buildResultDetails, hasWonByPacketLoss } from "./result.ts";
import { createSimulationState } from "./simulation.ts";

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

test("victory by packet loss requires staying strictly below 30%", () => {
  assert.equal(hasWonByPacketLoss(29), true);
  assert.equal(hasWonByPacketLoss(30), false);
  assert.equal(hasWonByPacketLoss(31), false);
});

test("result details persist total session packet loss and timeline instead of rolling loss", () => {
  const state = createSimulationState();
  state.deliveredPackets = 17;
  state.droppedPackets = 3;
  state.packetLoss = 41;
  state.packetLossHistory = [
    { second: 0, packetLoss: 0 },
    { second: 1, packetLoss: 20 },
    { second: 2, packetLoss: 15 },
  ];

  const details = buildResultDetails(state);

  assert.equal(details.network_metrics.packet_loss, 15);
  assert.deepEqual(details.packet_loss_timeline, [
    { second: 0, packet_loss: 0 },
    { second: 1, packet_loss: 20 },
    { second: 2, packet_loss: 15 },
  ]);
});
