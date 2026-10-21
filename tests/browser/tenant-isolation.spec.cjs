const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");
const WebSocket = require("../../apps/collab/node_modules/ws");
const config = require("./config.cjs");

test("two tenants reject foreign document HTTP access and forged WebSocket identity", async ({
  request,
}) => {
  const api = config.NEXT_PUBLIC_API_URL;
  async function login(email) {
    const r = await request.post(`${api}/auth/login`, {
      data: { email, password: config.TEST_PASSWORD },
    });
    expect(r.ok()).toBeTruthy();
    return (await r.json()).accessToken;
  }
  const owner = await login(config.TEST_OWNER_EMAIL);
  const foreign = await login(config.TEST_OTHER_EMAIL || "owner@globex.dev");
  const profile = await request.get(`${api}/users/me`, {
    headers: { Authorization: `Bearer ${foreign}` },
  });
  expect(profile.ok()).toBeTruthy();
  const other = await profile.json();
  const otherOrg = other.organizations.find((o) => o.id !== config.TEST_ORG).id;
  const headers = {
    Authorization: `Bearer ${owner}`,
    "x-organization-id": config.TEST_ORG,
  };
  const created = await request.post(`${api}/documents`, {
    headers,
    data: {
      projectId: config.TEST_PROJECT,
      title: "Tenant boundary " + randomUUID(),
    },
  });
  expect(created.ok()).toBeTruthy();
  const doc = await created.json();
  for (const org of [config.TEST_ORG, otherOrg]) {
    const h = { Authorization: `Bearer ${foreign}`, "x-organization-id": org };
    for (const path of [
      `/documents/${doc.id}`,
      `/documents/${doc.id}/threads`,
      `/documents/${doc.id}/versions`,
      `/documents/${doc.id}/grants`,
    ]) {
      const r = await request.get(api + path, { headers: h });
      expect([403, 404]).toContain(r.status());
      expect(await r.text()).not.toContain(doc.title);
    }
    const ticket = await request.post(
      `${api}/documents/${doc.id}/session-ticket`,
      { headers: h },
    );
    expect([403, 404]).toContain(ticket.status());
  }
  const forgedHeader = await request.get(`${api}/documents/${doc.id}`, {
    headers: { ...headers, "x-organization-id": otherOrg },
  });
  expect([403, 404]).toContain(forgedHeader.status());
  const t = await request.post(`${api}/documents/${doc.id}/session-ticket`, {
    headers,
  });
  expect(t.ok()).toBeTruthy();
  const ticket = await t.json();
  const legitimate = {
    v: 1,
    type: "auth",
    docSchema: 2,
    org: config.TEST_ORG,
    user: ticket.user.id,
    docId: doc.id,
    ticket: ticket.ticket,
  };
  const url = ticket.wsUrl || config.COLLAB_WS_URL;
  async function first(frame) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, { origin: config.WEB_URL });
      const timer = setTimeout(() => {
        ws.terminate();
        reject(Error("WebSocket auth timeout"));
      }, 15000);
      ws.once("open", () => ws.send(JSON.stringify(frame)));
      ws.once("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      ws.once("message", (raw) => {
        clearTimeout(timer);
        ws.close();
        resolve(JSON.parse(raw));
      });
    });
  }
  for (const mutation of [
    { org: otherOrg },
    { user: other.id },
    { docId: randomUUID() },
  ]) {
    const r = await first({ ...legitimate, ...mutation });
    expect(r.type).toBe("error");
    expect(r).not.toHaveProperty("update");
  }
  expect((await first(legitimate)).type).toBe("authenticated");
  expect((await first(legitimate)).type).toBe("error"); // ticket is single-use
  expect(
    (await request.get(`${api}/documents/${doc.id}`, { headers })).ok(),
  ).toBeTruthy();
});
