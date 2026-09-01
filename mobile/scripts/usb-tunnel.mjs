// USB demo tunnel: Mac :8443 → intranet edge :443 (raw TCP — TLS stays
// end-to-end between the phone app and the Istio ingressgateway, which
// serves the public *.nexedge.ae certificate).
//
// Usage (phone attached over USB, Mac on the corporate VPN):
//   node mobile/scripts/usb-tunnel.mjs &
//   adb reverse tcp:443 tcp:8443
//
// The app's pinned DNS tries 127.0.0.1 first (this tunnel via adb reverse),
// then the intranet LB directly — so the same APK works on corp-VPN Wi-Fi
// without the tunnel. See mobile/plugins/withXCollabNetwork.js.
import net from "node:net";

const TARGET_HOST = process.env.XCOLLAB_EDGE ?? "172.26.34.221";
const TARGET_PORT = 443;
const LISTEN_PORT = Number(process.env.TUNNEL_PORT ?? 8443);

const server = net.createServer((client) => {
  const upstream = net.connect(TARGET_PORT, TARGET_HOST);
  client.pipe(upstream);
  upstream.pipe(client);
  const drop = () => {
    client.destroy();
    upstream.destroy();
  };
  client.on("error", drop);
  upstream.on("error", drop);
});

server.listen(LISTEN_PORT, "127.0.0.1", () => {
  console.log(`usb-tunnel: 127.0.0.1:${LISTEN_PORT} → ${TARGET_HOST}:${TARGET_PORT}`);
});
