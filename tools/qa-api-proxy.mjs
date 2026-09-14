#!/usr/bin/env node
/**
 * Local QA-only CORS proxy. Forwards to the deployed HTTP API so localhost
 * browser forms and /admin can talk to DynamoDB without changing production CORS.
 */
import http from "node:http";
import https from "node:https";

const TARGET = process.env.API_BASE || "https://qa1lggny98.execute-api.ap-south-1.amazonaws.com";
const PORT = Number(process.env.PROXY_PORT || 9000);
const target = new URL(TARGET);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,x-admin-token",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  const path = req.url || "/";
  const headers = { ...req.headers, host: target.host };
  delete headers["connection"];
  const upstream = https.request(
    {
      hostname: target.hostname,
      port: 443,
      path,
      method: req.method,
      headers,
    },
    (up) => {
      const outHeaders = { ...up.headers, ...CORS };
      res.writeHead(up.statusCode || 502, outHeaders);
      up.pipe(res);
    }
  );
  upstream.on("error", (err) => {
    res.writeHead(502, { ...CORS, "content-type": "application/json" });
    res.end(JSON.stringify({ error: String(err.message) }));
  });
  req.pipe(upstream);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("QA API proxy http://127.0.0.1:" + PORT + " -> " + TARGET);
});
