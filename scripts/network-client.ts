import { Client, type Room } from "colyseus.js";
import { randomUUID } from "node:crypto";
import type {
  Command,
  GameEvent,
  Profile,
  WorldSnapshot,
} from "../packages/shared/types.js";
export const base = process.env.SERVER_URL ?? "http://127.0.0.1:2567";
export const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
export async function until(
  test: () => boolean,
  timeout = 8000,
  label?: string | (() => string),
) {
  const start = Date.now();
  while (!test()) {
    if (Date.now() - start > timeout)
      throw new Error(
        `Timed out waiting for server state${label ? `: ${typeof label === "string" ? label : label()}` : "."}`,
      );
    await delay(30);
  }
}
export class NetworkPlayer {
  room!: Room;
  token = "";
  profile!: Profile;
  world?: WorldSnapshot;
  events: GameEvent[] = [];
  errors: string[] = [];
  bytes = 0;
  snapshots = 0;
  static async create(nickname: string, token?: string, roomId?: string) {
    const p = new NetworkPlayer();
    const res = await fetch(`${base}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, ...(token ? { token } : {}) }),
    });
    const auth = (await res.json()) as {
      token: string;
      profile: Profile;
      message?: string;
    };
    if (!res.ok) throw new Error(auth.message);
    p.token = auth.token;
    p.profile = auth.profile;
    await p.join(roomId);
    return p;
  }
  async join(roomId?: string) {
    const client = new Client(base);
    this.room = await (roomId === "new"
      ? client.create("island", { token: this.token })
      : roomId
        ? client.joinById(roomId, { token: this.token })
        : client.joinOrCreate("island", { token: this.token }));
    this.room.onMessage("world", (w: WorldSnapshot) => {
      this.world = w;
      this.bytes += JSON.stringify(w).length;
      this.snapshots++;
    });
    this.room.onMessage("profile", (p: Profile) => (this.profile = p));
    this.room.onMessage("event", (e: GameEvent) => this.events.push(e));
    this.room.onMessage("error", (e: { message: string }) =>
      this.errors.push(e.message),
    );
    this.room.onError((code, message) =>
      this.errors.push(`${code}: ${message}`),
    );
    this.room.onLeave((code) => {
      if (code !== 1000 && code !== 4000) this.errors.push(`left: ${code}`);
    });
    await until(() => !!this.world);
  }
  send(command: Command) {
    this.room.send(
      "command",
      command.kind === "move"
        ? command
        : { requestId: randomUUID(), ...command },
    );
  }
  get self() {
    return this.world?.players.find((p) => p.id === this.profile.id);
  }
  async starter(species = "bulbasaur") {
    this.send({
      kind: "starter",
      species:
        (
          {
            spriglet: "bulbasaur",
            cindercub: "charmander",
            brookfin: "squirtle",
          } as Record<string, string>
        )[species] ?? species,
      classId: "mage",
    });
    await until(() => this.profile.creatures.length > 0);
  }
  async go(x: number, z: number, timeout = 30000) {
    const started = Date.now();
    while (true) {
      const me = this.self;
      if (!me) throw new Error("Player missing");
      const dx = x - me.x,
        dz = z - me.z,
        d = Math.hypot(dx, dz);
      if (d < 1.3) break;
      if (Date.now() - started > timeout)
        throw new Error(
          `Movement stuck at ${me.x},${me.z}; goal ${x},${z}; hp ${me.hp}; snapshot age ${Date.now() - (this.world?.time ?? 0)}ms; stunned ${(me.stunUntil ?? 0) > Date.now()}; nearby ${JSON.stringify(
            this.world?.wilds
              .filter((w) => w.hp > 0 && Math.hypot(w.x - me.x, w.z - me.z) < 3)
              .map((w) => [w.id, w.state, w.target === me.id]),
          )}; errors ${JSON.stringify(this.errors.slice(-3))}`,
        );
      this.send({
        kind: "move",
        dx: dx / Math.max(1, d),
        dz: dz / Math.max(1, d),
        yaw: Math.atan2(dx, dz),
        sprint: true,
      });
      await delay(100);
    }
    this.stop();
  }
  stop() {
    this.send({ kind: "move", dx: 0, dz: 0, yaw: 0, sprint: false });
  }
  async close() {
    if (this.room?.connection.isOpen) await this.room.leave();
  }
}
