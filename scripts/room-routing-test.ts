import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { Client } from "colyseus.js";
import { NetworkPlayer, base, until } from "./network-client.js";

const players: NetworkPlayer[] = [];
try {
  for (let index = 0; index < 16; index++) {
    players.push(
      await NetworkPlayer.create(
        `Route${Date.now().toString(36)}${index}`,
        undefined,
        index === 0 ? "new" : players[0].room.roomId,
      ),
    );
  }
  const fullRoom = players[0].room.roomId;
  await until(() => players[0].world?.players.length === 16);
  const overflow = await NetworkPlayer.create(
    `Extra${Date.now().toString(36)}`,
  );
  players.push(overflow);
  assert.notEqual(overflow.room.roomId, fullRoom);
  await assert.rejects(
    new Client(base).joinById(fullRoom, { token: overflow.token }),
    /locked|full|maxClients/i,
  );
  assert(overflow.room.connection.isOpen);
  const result = {
    passed: true,
    timestamp: new Date().toISOString(),
    fullRoom,
    fullRoomPlayers: 16,
    overflowRoom: overflow.room.roomId,
    checks: [
      "Sixteen separate guest clients share one room",
      "Automatic matchmaking routes the next guest to another room",
      "An explicit join to the full room is rejected without disrupting the existing session",
    ],
  };
  await writeFile(
    "evidence/room-routing-test.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await Promise.all(players.map((player) => player.close()));
}
