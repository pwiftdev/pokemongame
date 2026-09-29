import type { Client } from "@colyseus/core";
export function safeSend(client: Client, type: string, payload: unknown) {
  try {
    client.send(type, payload);
  } catch (error) {
    console.error("Client delivery failed after authoritative update", error);
  }
}
