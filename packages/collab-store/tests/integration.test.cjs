const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const Y = require("yjs");
const { Store, materialize } = require("../index.cjs");
const enabled = !!process.env.COLLAB_TEST_DATABASE_URL;
const { Pool } = require("pg");

test(
  "group commit authorizes each actor, deduplicates receipts and rolls back every edit on commit failure",
  { skip: !enabled },
  async () => {
    const s = new Store(process.env.COLLAB_TEST_DATABASE_URL),
      admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
    const owner = { org: process.env.TEST_ORG, user: process.env.TEST_OWNER },
      member = { org: process.env.TEST_ORG, user: process.env.TEST_MEMBER };
    const d = await s.create(owner, process.env.TEST_PROJECT, {
      title: "Batch proof " + randomUUID(),
    });
    const input = (text) => {
      const y = new Y.Doc();
      y.getText("batch").insert(0, text);
      return {
        updateId: randomUUID(),
        update: Buffer.from(Y.encodeStateAsUpdate(y)).toString("base64"),
      };
    };
    const fn = "batch_fail_" + randomUUID().replaceAll("-", "");
    try {
      await s.grant(owner, d.id, { userId: member.user, role: "VIEWER" });
      const a = input("owner"),
        b = input("viewer");
      const results = await s.updateBatch(d.id, [
        { ctx: owner, input: a },
        { ctx: member, input: b },
        { ctx: owner, input: a },
      ]);
      assert.equal(results[0].ok, true);
      assert.equal(results[1].error.code, "READ_ONLY");
      assert.equal(results[2].duplicate, true);
      assert.equal(
        (
          await admin.query(
            "SELECT count(*)::int n FROM collab_update WHERE document_id=$1",
            [d.id],
          )
        ).rows[0].n,
        1,
      );
      await s.grant(owner, d.id, { userId: member.user, role: "EDITOR" });
      const c = input("editor"),
        e = input("owner again");
      const accepted = await s.updateBatch(d.id, [
        { ctx: member, input: c },
        { ctx: owner, input: e },
      ]);
      assert.ok(accepted.every((r) => r.ok));
      assert.notEqual(accepted[0].seq, accepted[1].seq);
      await admin.query(
        `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.document_id='${d.id}' THEN RAISE EXCEPTION 'synthetic deferred batch failure'; END IF; RETURN NEW; END $$`,
      );
      await admin.query(
        `CREATE CONSTRAINT TRIGGER ${fn} AFTER INSERT ON collab_update DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
      );
      const f = input("rollback one"),
        g = input("rollback two");
      await assert.rejects(
        s.updateBatch(d.id, [
          { ctx: owner, input: f },
          { ctx: member, input: g },
        ]),
        /synthetic deferred batch failure/,
      );
      assert.equal(
        (
          await admin.query(
            "SELECT count(*)::int n FROM collab_update WHERE document_id=$1",
            [d.id],
          )
        ).rows[0].n,
        3,
      );
      assert.equal((await s.detail(owner, d.id)).seq, "3");
    } finally {
      await admin.query(`DROP TRIGGER IF EXISTS ${fn} ON collab_update`);
      await admin.query(`DROP FUNCTION IF EXISTS ${fn}()`);
      await admin.query("DELETE FROM collab_document WHERE id=$1", [d.id]);
      await s.close();
      await admin.end();
    }
  },
);
test(
  "real nonprivileged PostgreSQL: isolation, grants, durable retries, comments and history",
  { skip: !enabled },
  async () => {
    const s = new Store(process.env.COLLAB_TEST_DATABASE_URL);
    const db = await s.pool.connect();
    let ctx, other, viewer, project, id;
    try {
      const role = (
        await db.query(
          "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
        )
      ).rows[0];
      assert.equal(role.rolsuper, false);
      assert.equal(role.rolbypassrls, false);
      // Discover only synthetic seeded users through explicit user/org contexts.
      ctx = { org: process.env.TEST_ORG, user: process.env.TEST_OWNER };
      other = {
        org: process.env.TEST_OTHER_ORG,
        user: process.env.TEST_OTHER_USER,
      };
      viewer = { org: ctx.org, user: process.env.TEST_MEMBER };
      project = process.env.TEST_PROJECT;
      const d = await s.create(ctx, project, {
        title: "Integration " + randomUUID(),
      });
      id = d.id;
      assert.equal(
        (await s.list(ctx, project)).some((v) => v.id === id),
        true,
      );
      await assert.rejects(s.detail(other, id), { code: "NOT_FOUND" });
      await assert.rejects(s.detail(viewer, id), { code: "NOT_FOUND" });
      await s.grant(ctx, id, { userId: viewer.user, role: "VIEWER" });
      assert.equal((await s.detail(viewer, id)).role, "VIEWER");
      const y = new Y.Doc();
      const p = new Y.XmlElement("paragraph"),
        t = new Y.XmlText();
      p.insert(0, [t]);
      t.insert(0, "Durable approval");
      y.getXmlFragment("default").insert(0, [p]);
      const u = {
        updateId: randomUUID(),
        update: Buffer.from(Y.encodeStateAsUpdate(y)).toString("base64"),
      };
      await assert.rejects(s.update(viewer, id, u), { code: "READ_ONLY" });
      const ack = await s.update(ctx, id, u);
      assert.equal((await s.update(ctx, id, u)).seq, ack.seq);
      const reconnected = new Store(process.env.COLLAB_TEST_DATABASE_URL);
      try {
        const sync = await reconnected.sync(ctx, id, "AA==");
        const loaded = materialize(Buffer.from(sync.update, "base64"));
        assert.match(
          loaded.getXmlFragment("default").toString(),
          /Durable approval/,
        );
      } finally {
        await reconnected.close();
      }
      await assert.rejects(
        s.update(ctx, id, {
          ...u,
          update: Buffer.from([0, 0]).toString("base64"),
        }),
        { code: "UPDATE_ID_REUSED" },
      );
      const ticket = await s.ticket(ctx, id);
      await s.consume(ctx, id, ticket.ticket);
      await assert.rejects(s.consume(ctx, id, ticket.ticket), {
        code: "INVALID_TICKET",
      });
      await assert.rejects(
        s.grant(ctx, id, { userId: ctx.user, role: "REMOVE" }),
        { code: "LAST_OWNER" },
      );
      await s.grant(ctx, id, { userId: viewer.user, role: "COMMENTER" });
      const audit = await s.tx(ctx, (c) =>
        c.query(
          "SELECT actor_id,trace_id,before_value,after_value FROM sys_oper_log WHERE resource_id=$1 AND action='document:grant' ORDER BY created_at DESC LIMIT 1",
          [id],
        ),
      );
      assert.equal(audit.rows[0].actor_id, ctx.user);
      assert.ok(audit.rows[0].trace_id);
      assert.equal(audit.rows[0].before_value.role, "VIEWER");
      assert.equal(audit.rows[0].after_value.role, "COMMENTER");
      const thread = {
        id: randomUUID(),
        body: "Please clarify",
        quote: "",
        anchor: null,
      };
      await s.thread(viewer, id, thread);
      await s.thread(viewer, id, thread);
      assert.equal((await s.threads(ctx, id)).length, 1);
      await assert.rejects(
        s.thread(viewer, id, { ...thread, body: "different" }),
        { code: "IDEMPOTENCY_CONFLICT" },
      );
      await s.resolve(viewer, id, thread.id, { revision: 1, resolved: true });
      await assert.rejects(
        s.resolve(viewer, id, thread.id, { revision: 1, resolved: false }),
        { code: "REVISION_CONFLICT" },
      );
      const v = await s.version(ctx, id, {
        id: randomUUID(),
        name: "Accepted",
      });
      const restoreKey = { id: randomUUID() };
      const copy = await s.restore(ctx, id, v.id, restoreKey);
      assert.equal((await s.restore(ctx, id, v.id, restoreKey)).id, copy.id);
      assert.notEqual(copy.id, id);
      await assert.rejects(s.detail(viewer, copy.id), { code: "NOT_FOUND" });
      const preview = await s.preview(ctx, id, v.id);
      assert.match(
        materialize(Buffer.from(preview.state, "base64"))
          .getXmlFragment("default")
          .toString(),
        /Durable approval/,
      );
      await s.grant(ctx, id, { userId: viewer.user, role: "REMOVE" });
      await assert.rejects(s.sync(viewer, id, "AA=="), { code: "NOT_FOUND" });
      await s.rename(ctx, id, { title: "Renamed", revision: 1 });
      await assert.rejects(
        s.rename(ctx, id, { title: "Lost edit", revision: 1 }),
        { code: "REVISION_CONFLICT" },
      );
      await s.archive(ctx, id);
      await assert.rejects(
        s.update(ctx, id, { ...u, updateId: randomUUID() }),
        { code: "DOCUMENT_ARCHIVED" },
      );
      await db.query("BEGIN");
      await db.query("SELECT set_config('app.current_org_id',$1,true)", [
        other.org,
      ]);
      assert.equal(
        (await db.query("SELECT id FROM collab_document WHERE id=$1", [id]))
          .rowCount,
        0,
      );
      await db.query("ROLLBACK");
    } finally {
      db.release();
      await s.close();
    }
  },
);

test(
  "fan-out excludes restricted, suspended and revoked recipients; parent revocation fences queued writes",
  { skip: !enabled },
  async () => {
    const s = new Store(process.env.COLLAB_TEST_DATABASE_URL),
      admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
    const org = process.env.TEST_ORG,
      ownerId = randomUUID(),
      memberId = randomUUID(),
      projectId = randomUUID(),
      groupId = randomUUID();
    const owner = { org, user: ownerId },
      member = { org, user: memberId };
    try {
      for (const [id, name] of [
        [ownerId, "Fencing owner"],
        [memberId, "Fencing editor"],
      ]) {
        await admin.query(
          "INSERT INTO sys_user(id,email,name,status,updated_at) VALUES($1,$2,$3,'NORMAL',now())",
          [id, `${id}@synthetic.invalid`, name],
        );
        await admin.query(
          "INSERT INTO org_membership(id,organization_id,user_id,status) VALUES($1,$2,$3,'ACTIVE')",
          [randomUUID(), org, id],
        );
      }
      const workspace = (
        await admin.query("SELECT workspace_id FROM prj_project WHERE id=$1", [
          process.env.TEST_PROJECT,
        ])
      ).rows[0].workspace_id;
      await admin.query(
        "INSERT INTO prj_project(id,organization_id,workspace_id,owner_id,name,status,visibility,updated_at) VALUES($1,$2,$3,$4,'Fencing test','ACTIVE','RESTRICTED',now())",
        [projectId, org, workspace, ownerId],
      );
      const d = await s.create(owner, projectId, {
        title: "Restricted audience",
      });
      await s.grant(owner, d.id, { userId: memberId, role: "EDITOR" });
      const doc = new Y.Doc();
      const updates = [];
      doc.on("update", (bytes) =>
        updates.push({
          updateId: randomUUID(),
          update: Buffer.from(bytes).toString("base64"),
        }),
      );
      doc.getText("proof").insert(0, "one");
      const first = await s.update(owner, d.id, updates.at(-1));
      assert.equal(
        first.readers.some((r) => r.user_id === memberId),
        false,
      );
      await s.grant(owner, d.id, { userId: memberId, role: "OWNER" });
      await assert.rejects(
        s.grant(owner, d.id, { userId: ownerId, role: "REMOVE" }),
        { code: "LAST_OWNER" },
      );
      await s.grant(owner, d.id, { userId: memberId, role: "REMOVE" });
      await s.grant(owner, d.id, { userId: memberId, role: "EDITOR" });
      await assert.rejects(s.sync(member, d.id, "AA=="), { code: "NOT_FOUND" });
      await admin.query(
        "UPDATE prj_project SET visibility='ORGANIZATION' WHERE id=$1",
        [projectId],
      );
      doc.getText("proof").insert(0, "two");
      const visible = await s.update(owner, d.id, updates.at(-1));
      assert.equal(
        visible.readers.some((r) => r.user_id === memberId),
        true,
      );
      const blocker = await admin.connect();
      await blocker.query("BEGIN");
      await blocker.query(
        "UPDATE org_membership SET status='SUSPENDED' WHERE organization_id=$1 AND user_id=$2",
        [org, memberId],
      );
      doc.getText("proof").insert(0, "must reject");
      let finished = false;
      const denied = s.update(member, d.id, updates.at(-1)).then(
        () => {
          finished = true;
          return null;
        },
        (e) => {
          finished = true;
          return e;
        },
      );
      await new Promise((r) => setTimeout(r, 120));
      assert.equal(finished, false, "write must wait for revocation lock");
      await blocker.query("COMMIT");
      blocker.release();
      assert.equal((await denied).code, "NOT_FOUND");
      doc.getText("proof").insert(0, "three");
      const suspended = await s.update(owner, d.id, updates.at(-1));
      assert.equal(
        suspended.readers.some((r) => r.user_id === memberId),
        false,
      );
      await admin.query(
        "UPDATE org_membership SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2",
        [org, memberId],
      );
      await s.grant(owner, d.id, { userId: memberId, role: "OWNER" });
      await admin.query(
        "UPDATE org_membership SET status='SUSPENDED' WHERE organization_id=$1 AND user_id=$2",
        [org, memberId],
      );
      await assert.rejects(
        s.grant(owner, d.id, { userId: ownerId, role: "REMOVE" }),
        { code: "LAST_OWNER" },
      );
      await s.grant(owner, d.id, { userId: memberId, role: "REMOVE" });
      await admin.query(
        "UPDATE org_membership SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2",
        [org, memberId],
      );
      await s.grant(owner, d.id, { userId: memberId, role: "REMOVE" });
      doc.getText("proof").insert(0, "four");
      const revoked = await s.update(owner, d.id, updates.at(-1));
      assert.equal(
        revoked.readers.some((r) => r.user_id === memberId),
        false,
      );
      await assert.rejects(s.sync(member, d.id, "AA=="), { code: "NOT_FOUND" });
    } finally {
      await admin.query("DELETE FROM collab_document WHERE project_id=$1", [
        projectId,
      ]);
      await admin.query("DELETE FROM prj_project WHERE id=$1", [projectId]);
      await admin.query("DELETE FROM org_membership WHERE user_id=ANY($1)", [
        [ownerId, memberId],
      ]);
      await admin.query("DELETE FROM sys_user WHERE id=ANY($1)", [
        [ownerId, memberId],
      ]);
      await s.close();
      await admin.end();
    }
  },
);
