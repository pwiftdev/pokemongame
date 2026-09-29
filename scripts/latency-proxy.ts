import net from "node:net";
const latency = Number(process.env.LATENCY_MS ?? 75);
const proxy = net.createServer((client) => {
  const upstream = net.connect(2567, "127.0.0.1");
  const timers = new Set<NodeJS.Timeout>();
  const forward = (destination: net.Socket, data: Buffer) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!destination.destroyed) destination.write(data);
    }, latency);
    timers.add(timer);
  };
  client.on("data", (data) => forward(upstream, data));
  upstream.on("data", (data) => forward(client, data));
  const close = () => {
    for (const timer of timers) clearTimeout(timer);
    client.destroy();
    upstream.destroy();
  };
  client.on("close", close);
  upstream.on("close", close);
  client.on("error", close);
  upstream.on("error", close);
});
proxy.listen(2568, "127.0.0.1", () =>
  console.log(
    `Test proxy :2568 adds ${latency}ms each way (${latency * 2}ms RTT).`,
  ),
);
