const { Pool } = require("pg");
const Y = require("yjs");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const { z } = require("zod");
const { isDeepStrictEqual } = require("node:util");
const { validateBoard } = require("@collabspace/protocol");
class StoreError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
const fail = (status, code) => {
  throw new StoreError(status, code);
};
const hash = (b) => createHash("sha256").update(b).digest("hex");
const text = z.string().trim().min(1).max(5000);
const title = z.string().trim().min(1).max(160);
const uuid = z.string().uuid();
const roles = ["OWNER", "EDITOR", "COMMENTER", "VIEWER"];
function decoded(s, max = 256 * 1024) {
  if (
    typeof s !== "string" ||
    s.length > Math.ceil(max / 3) * 4 ||
    !/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s)
  )
    fail(400, "INVALID_UPDATE");
  const b = Buffer.from(s, "base64");
  if (b.length > max) fail(413, "UPDATE_TOO_LARGE");
  return b;
}
function materialize(bytes) {
  const d = new Y.Doc();
  Y.applyUpdate(d, bytes);
  return d;
}
function imageIds(doc) {
  const ids = new Set();
  const visit = (node) => {
    if (node instanceof Y.XmlElement && node.nodeName === "documentImage") {
      const attrs = node.getAttributes();
      try {
        z.object({assetId:uuid,alt:z.string().max(300),caption:z.string().max(1000),width:z.union([z.literal(50),z.literal(75),z.literal(100)])}).strict().parse(attrs);
      } catch { fail(400,"INVALID_DOCUMENT_IMAGE"); }
      ids.add(attrs.assetId);
    }
    if (node instanceof Y.XmlFragment || node instanceof Y.XmlElement)
      for (const child of node.toArray()) visit(child);
  };
  visit(doc.getXmlFragment("default"));
  if (ids.size > 20) fail(400,"IMAGE_LIMIT");
  return [...ids];
}
function checkBoard(doc) {
  if ([...doc.share.keys()].some((key) => !["shapes", "mermaid"].includes(key)))
    fail(400, "INVALID_BOARD");
  const shapes = doc.getMap("shapes");
  for (const shape of shapes.values())
    if (!(shape instanceof Y.Map)) fail(400, "INVALID_BOARD");
  try {
    validateBoard(shapes.toJSON());
    const source = doc.getText("mermaid");
    if (source.length > 32000 || source.toDelta().some(part =>
      typeof part.insert !== "string" || part.attributes)) throw Error("INVALID_MERMAID_SOURCE");
  } catch {
    fail(400, "INVALID_BOARD");
  }
}
function copyContent(bytes, kind = "DOCUMENT") {
  const old = materialize(bytes),
    fresh = new Y.Doc();
  if(kind==='MARKDOWN'){
    fresh.getText('markdown').insert(0,old.getText('markdown').toString());
  } else if (kind === "BOARD") {
    fresh.getText("mermaid").insert(0, old.getText("mermaid").toString());
    for (const [id, shape] of old.getMap("shapes"))
      fresh.getMap("shapes").set(id, shape.clone());
  } else {
    const root = old.getXmlFragment("default");
    fresh.getXmlFragment("default").insert(
      0,
      root.toArray().map((n) => n.clone()),
    );
  }
  const result = Buffer.from(Y.encodeStateAsUpdate(fresh));
  old.destroy();
  fresh.destroy();
  return result;
}
function checkMarkdown(doc){
  if([...doc.share.keys()].some(key=>key!=='markdown'))fail(400,'INVALID_MARKDOWN');
  const source=doc.getText('markdown');
  if(source.length>64000||source.toString().includes('\0')||Buffer.byteLength(source.toString(),'utf8')>200000||source.toDelta().some(p=>typeof p.insert!=='string'||p.attributes))fail(400,'INVALID_MARKDOWN');
}
class Store {
  async checkImages(c,ctx,id,doc) {
    const ids=imageIds(doc);
    if (!ids.length) return;
    const result=await c.query("SELECT id FROM collab_image WHERE organization_id=$1 AND document_id=$2 AND id=ANY($3::uuid[])",[ctx.org,id,ids]);
    if(result.rows.length!==ids.length) fail(400,"INVALID_DOCUMENT_IMAGE");
  }
  async addImage(ctx,id,bytes) {
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length>5*1024*1024) fail(413,"IMAGE_TOO_LARGE");
    const mime=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?"image/png":
      bytes[0]===255 && bytes[1]===216 && bytes[2]===255?"image/jpeg":
      bytes.toString("ascii",0,4)==="RIFF" && bytes.toString("ascii",8,12)==="WEBP"?"image/webp":null;
    if(!mime) fail(400,"IMAGE_TYPE_NOT_ALLOWED");
    return this.tx(ctx,async c=>{
      const d=await this.access(c,ctx,id,"write");
      if(d.kind!=="DOCUMENT") fail(400,"DOCUMENT_REQUIRED");
      const usage=(await c.query("SELECT count(*)::int AS count,coalesce(sum(octet_length(bytes)),0)::int AS size FROM collab_image WHERE organization_id=$1 AND document_id=$2",[ctx.org,id])).rows[0];
      if(usage.count>=20 || usage.size+bytes.length>20*1024*1024) fail(413,"IMAGE_QUOTA_EXCEEDED");
      const key=randomUUID();
      await c.query("INSERT INTO collab_image(organization_id,document_id,id,mime,bytes,created_by) VALUES($1,$2,$3,$4,$5,$6)",[ctx.org,id,key,mime,bytes,ctx.user]);
      await this.audit(c,ctx,id,"document:image-upload",null,{imageId:key,mime,size:bytes.length});
      return {id:key,mime,size:bytes.length};
    });
  }
  async image(ctx,id,key) {
    return this.tx(ctx,async c=>{
      await this.access(c,ctx,id);
      const result=(await c.query("SELECT mime,bytes FROM collab_image WHERE organization_id=$1 AND document_id=$2 AND id=$3",[ctx.org,id,uuid.parse(key)])).rows[0];
      if(!result) fail(404,"NOT_FOUND");
      return result;
    });
  }
  constructor(url = process.env.DATABASE_URL) {
    if (!url) throw new Error("DATABASE_URL required");
    this.pool = new Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5000,
    });
  }
  close() {
    return this.pool.end();
  }
  async metadataDelivery(ctx,id,deliver) {
    return this.tx(ctx,async c=>{await this.access(c,ctx,id);deliver();});
  }
  async listenMetadata(callback) {
    const client=await this.pool.connect();
    const receive=notification=>{if(notification.channel==='collab_metadata')try{Promise.resolve(callback(JSON.parse(notification.payload))).catch(()=>{});}catch{}};
    client.on('notification',receive);
    // A connection loss is handled by the WS owner; no secrets/content in hints.
    try{await client.query('LISTEN collab_metadata');}catch(e){client.release(true);throw e;}
    return client;
  }
  async assertRuntime(db = this.pool) {
    // Deployment gate, not a replacement for per-operation ACL checks.
    const names = [
      "collab_document",
      "collab_grant",
      "collab_update",
      "collab_ticket",
      "collab_thread",
      "collab_reply",
      "collab_version",
      "collab_restore",
      "collab_image",
    ];
    const { rows } = await db.query(
      `
      SELECT r.rolsuper OR r.rolbypassrls AS unsafe,
        c.relname, c.relowner = r.oid AS owns_table,
        c.relrowsecurity AND c.relforcerowsecurity AS protected,
        EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid
          AND p.polname='tenant' AND p.polcmd='*'
          AND p.polqual IS NOT NULL AND p.polwithcheck IS NOT NULL) AS policy
      FROM pg_roles r
      LEFT JOIN (pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        AND n.nspname='public') ON c.relname=ANY($1::text[])
      WHERE r.rolname=current_user`,
      [names],
    );
    if (!rows.length || rows.some((r) => r.unsafe || r.owns_table))
      throw new Error(
        "Collaboration runtime role must not own tables or bypass RLS",
      );
    if (
      rows.length !== names.length ||
      rows.some((r) => !r.protected || !r.policy)
    )
      throw new Error(
        "Collaboration schema, forced RLS and tenant policies are required",
      );
  }
  async tx(ctx, fn) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN; SET LOCAL statement_timeout='10s'");
      await c.query(
        "SELECT set_config('app.current_org_id',$1,true),set_config('app.current_user_id',$2,true)",
        [ctx.org, ctx.user],
      );
      const r = await fn(c);
      await c.query("COMMIT");
      return r;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async parent(c, ctx, project) {
    // FOR SHARE conflicts with UPDATE/DELETE of the existing parent controllers.
    // Recheck status after locks, rather than trusting stale JWT/membership caches.
    const locked = (
      await c.query(
        `
      SELECT u.id,u.name,u.password_hash,u.status AS user_status,o.status AS org_status,
             m.status AS member_status,p.id AS project_id,p.status AS project_status,p.owner_id,p.visibility
      FROM sys_user u
      JOIN org_membership m ON m.user_id=u.id AND m.organization_id=$2
      JOIN org_organization o ON o.id=m.organization_id
      JOIN prj_project p ON p.organization_id=o.id AND p.id=$3
      WHERE u.id=$1 FOR SHARE OF u,o,m,p`,
        [ctx.user, ctx.org, project],
      )
    ).rows[0];
    if (
      !locked ||
      locked.user_status !== "NORMAL" ||
      locked.org_status !== "ACTIVE" ||
      locked.member_status !== "ACTIVE"
    )
      fail(404, "NOT_FOUND");
    if(ctx.credentialState&&ctx.credentialState!==hash(locked.password_hash||"oauth-only"))fail(401,"SESSION_EXPIRED");
    const u = { id: locked.id, name: locked.name };
    const p = {
      id: locked.project_id,
      status: locked.project_status,
      owner_id: locked.owner_id,
      visibility: locked.visibility,
      access: 'WRITE',
    };
    if (p.visibility === "RESTRICTED" && p.owner_id !== ctx.user) {
      const admin = await c.query(
        "SELECT r.id FROM sys_role r JOIN org_membership_role mr ON mr.role_id=r.id JOIN org_membership m ON m.id=mr.membership_id WHERE m.organization_id=$1 AND m.user_id=$2 AND r.status='NORMAL' AND r.role_key IN ('OWNER','ADMIN') FOR SHARE OF r,mr",
        [ctx.org, ctx.user],
      );
      if (!admin.rowCount) {
        const allowed = await c.query(
          "SELECT g.id,g.access FROM org_resource_grant g JOIN org_collaboration_group u ON u.id=g.group_id AND u.organization_id=g.organization_id JOIN org_group_member gm ON gm.group_id=u.id AND gm.organization_id=u.organization_id JOIN org_membership m ON m.id=gm.membership_id WHERE g.organization_id=$1 AND g.project_id=$2 AND m.user_id=$3 AND u.archived_at IS NULL FOR SHARE OF g,u,gm",
          [ctx.org, project, ctx.user],
        );
        if (!allowed.rowCount) fail(404, "NOT_FOUND");
        if(!allowed.rows.some(g=>['WRITE','MANAGE'].includes(g.access)))p.access='READ';
      }
    }
    return { u, p };
  }
  async access(c, ctx, id, action = "read") {
    const ref = (
      await c.query(
        "SELECT project_id FROM collab_document WHERE organization_id=$1 AND id=$2",
        [ctx.org, id],
      )
    ).rows[0];
    if (!ref) fail(404, "NOT_FOUND");
    const { u, p } = await this.parent(c, ctx, ref.project_id);
    const d = (
      await c.query(
        "SELECT * FROM collab_document WHERE organization_id=$1 AND id=$2 FOR UPDATE",
        [ctx.org, id],
      )
    ).rows[0];
    if (!d) fail(404, "NOT_FOUND");
    const g = (
      await c.query(
        "SELECT role FROM collab_grant WHERE organization_id=$1 AND document_id=$2 AND user_id=$3",
        [ctx.org, id, ctx.user],
      )
    ).rows[0];
    if (!g) fail(404, "NOT_FOUND");
    if(action!=='read'&&p.access==='READ')fail(403,'READ_ONLY');
    if (action !== "read" && (d.status !== "ACTIVE" || p.status === "ARCHIVED"))
      fail(409, "DOCUMENT_ARCHIVED");
    if (action === "write" && !["OWNER", "EDITOR"].includes(g.role))
      fail(403, "READ_ONLY");
    if (action === "comment" && g.role === "VIEWER") fail(403, "READ_ONLY");
    if (action === "owner" && g.role !== "OWNER") fail(403, "OWNER_REQUIRED");
    return {
      ...d,
      role:
        action === "read" && (d.status !== "ACTIVE" || p.status === "ARCHIVED" || p.access==='READ')
          ? "VIEWER"
          : g.role,
      userName: u.name,
    };
  }
  meta(d) {
    const { state, ...rest } = d;
    return rest;
  }
  async audit(c, ctx, id, action, before = null, after = null) {
    if(['document:comment','document:resolve','document:reply','document:version'].includes(action))
      await c.query("SELECT pg_notify('collab_metadata',$1)",[JSON.stringify({org:ctx.org,docId:id})]);
    await c.query(
      "INSERT INTO sys_oper_log(id,organization_id,actor_id,title,business_type,action,resource_type,resource_id,trace_id,before_value,after_value) VALUES($1,$2,$3,$4,2,$5,$6,$7,$8,$9::jsonb,$10::jsonb)",
      [
        randomUUID(),
        ctx.org,
        ctx.user,
        "协作文档",
        action,
        "CollabDocument",
        id,
        randomUUID(),
        JSON.stringify(before),
        JSON.stringify(after),
      ],
    );
  }
  async list(ctx, project, options = {}) {
    const offset=z.coerce.number().int().min(0).default(0).parse(options.offset);
    const limit=z.coerce.number().int().min(1).max(100).default(100).parse(options.limit);
    return this.tx(ctx, async (c) => {
      await this.parent(c, ctx, project);
      return (
        await c.query(
          `SELECT d.id,d.title,d.kind,d.status,d.revision,d.updated_at,g.role,
           CASE WHEN d.kind='OFFICE' THEN CASE WHEN saved.after_value IS NULL THEN creator.name ELSE saved.after_value->'lastEditor'->>'name' END
                WHEN d.seq=0 THEN creator.name ELSE editor.name END AS last_editor
           FROM collab_document d JOIN collab_grant g ON g.document_id=d.id AND g.organization_id=d.organization_id
           LEFT JOIN sys_user creator ON creator.id=d.created_by
           LEFT JOIN LATERAL (SELECT actor_id FROM collab_update WHERE organization_id=d.organization_id AND document_id=d.id ORDER BY seq DESC LIMIT 1) last_edit ON true
           LEFT JOIN sys_user editor ON editor.id=last_edit.actor_id
           LEFT JOIN LATERAL (SELECT after_value FROM sys_oper_log WHERE organization_id=d.organization_id AND resource_id=d.id AND action='office:save' ORDER BY created_at DESC LIMIT 1) saved ON d.kind='OFFICE'
           WHERE d.organization_id=$1 AND d.project_id=$2 AND g.user_id=$3 ORDER BY d.updated_at DESC,d.id LIMIT $4 OFFSET $5`,
          [ctx.org, project, ctx.user,limit,offset],
        )
      ).rows;
    });
  }
  async mine(ctx){
    return this.tx(ctx,async c=>{
      const candidates=(await c.query("SELECT d.id,d.title,d.kind,d.project_id,d.updated_at,g.role FROM collab_document d JOIN collab_grant g ON g.organization_id=d.organization_id AND g.document_id=d.id AND g.user_id=$2 WHERE d.organization_id=$1 AND d.kind='MARKDOWN' ORDER BY d.updated_at DESC LIMIT 100",[ctx.org,ctx.user])).rows;
      const visible=[];
      for(const d of candidates){try{await this.access(c,ctx,d.id);visible.push(d);}catch(e){if(![403,404].includes(e.status))throw e;}}
      return visible;
    });
  }
  async create(ctx, project, input) {
    const name = title.parse(input.title);
    const kind = z
      .enum(["DOCUMENT", "BOARD", "MARKDOWN"])
      .default("DOCUMENT")
      .parse(input.kind);
    return this.tx(ctx, async (c) => {
      const { p } = await this.parent(c, ctx, project);
      if(p.access==='READ')fail(403,'READ_ONLY');
      if (p.status === "ARCHIVED") fail(409, "PROJECT_ARCHIVED");
      let state;
      if(kind==='MARKDOWN'){
        const source=z.string().max(64000).default('').parse(input.source);
        const initial=new Y.Doc();try{initial.getText('markdown').insert(0,source);checkMarkdown(initial);state=Buffer.from(Y.encodeStateAsUpdate(initial));}finally{initial.destroy();}
      }else if(kind==='BOARD'&&input.source!==undefined){
        const source=z.string().max(32000).parse(input.source);if(source.includes('\0'))fail(400,'INVALID_BOARD');
        const initial=new Y.Doc();try{initial.getText('mermaid').insert(0,source);checkBoard(initial);state=Buffer.from(Y.encodeStateAsUpdate(initial));}finally{initial.destroy();}
      }
      return this.insert(c, ctx, project, name, state, kind);
    });
  }
  async insert(c, ctx, project, name, state, kind = "DOCUMENT") {
    const id = randomUUID();
    const empty = new Y.Doc();
    if (kind === "DOCUMENT")
      empty
        .getXmlFragment("default")
        .insert(0, [new Y.XmlElement("paragraph")]);
    state = state || Buffer.from(Y.encodeStateAsUpdate(empty));
    empty.destroy();
    const d = (
      await c.query(
        "INSERT INTO collab_document(id,organization_id,project_id,title,state,created_by,kind) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [id, ctx.org, project, name, state, ctx.user, kind],
      )
    ).rows[0];
    await c.query("INSERT INTO collab_grant VALUES($1,$2,$3,'OWNER')", [
      ctx.org,
      id,
      ctx.user,
    ]);
    await this.audit(c, ctx, id, "document:create", null, {
      projectId: project,
      status: "ACTIVE",
      revision: 1,
    });
    return this.meta({ ...d, role: "OWNER" });
  }
  async detail(ctx, id) {
    return this.tx(ctx, async (c) => this.meta(await this.access(c, ctx, id)));
  }
  async rename(ctx, id, input) {
    const name = title.parse(input.title),
      revision = z.number().int().positive().parse(input.revision);
    return this.tx(ctx, async (c) => {
      const d = await this.access(c, ctx, id, "write");
      if (d.revision !== revision) fail(409, "REVISION_CONFLICT");
      await c.query(
        "UPDATE collab_document SET title=$1,revision=revision+1,updated_at=now() WHERE id=$2 AND organization_id=$3",
        [name, id, ctx.org],
      );
      await this.audit(
        c,
        ctx,
        id,
        "document:rename",
        { titleHash: hash(d.title), revision: d.revision },
        { titleHash: hash(name), revision: revision + 1 },
      );
      return { title: name, revision: revision + 1 };
    });
  }
  async archive(ctx, id) {
    return this.tx(ctx, async (c) => {
      const d = await this.access(c, ctx, id, "owner");
      await c.query(
        "UPDATE collab_document SET status='ARCHIVED',acl_epoch=acl_epoch+1 WHERE id=$1 AND organization_id=$2",
        [id, ctx.org],
      );
      await this.audit(
        c,
        ctx,
        id,
        "document:archive",
        { status: d.status, aclEpoch: d.acl_epoch },
        { status: "ARCHIVED", aclEpoch: d.acl_epoch + 1 },
      );
      return { ok: true };
    });
  }
  async grants(ctx, id) {
    return this.tx(ctx, async (c) => {
      await this.access(c, ctx, id, "owner");
      return (
        await c.query(
          "SELECT g.user_id,g.role,u.name,u.email FROM collab_grant g JOIN sys_user u ON u.id=g.user_id WHERE g.organization_id=$1 AND g.document_id=$2",
          [ctx.org, id],
        )
      ).rows;
    });
  }
  async grant(ctx, id, input) {
    const user = z.string().min(1).max(100).parse(input.userId);
    const role = z.enum([...roles, "REMOVE"]).parse(input.role);
    return this.tx(ctx, async (c) => {
      await this.access(c, ctx, id, "owner");
      const existing = (
        await c.query(
          "SELECT role FROM collab_grant WHERE organization_id=$1 AND document_id=$2 AND user_id=$3",
          [ctx.org, id, user],
        )
      ).rows[0];
      if (existing?.role === "OWNER" && role !== "OWNER") {
        await c.query(
          "SELECT m.id FROM collab_grant g JOIN org_membership m ON m.organization_id=g.organization_id AND m.user_id=g.user_id JOIN sys_user u ON u.id=g.user_id WHERE g.organization_id=$1 AND g.document_id=$2 AND g.role='OWNER' AND m.status='ACTIVE' AND u.status='NORMAL' ORDER BY m.id FOR SHARE OF m,u",
          [ctx.org, id],
        );
        // Count the owners who will remain after this change. A suspended or
        // parent-project-inaccessible grant cannot keep the document manageable.
        const remaining = (await this.readers(c, ctx, id)).filter(
          (r) => r.role === "OWNER" && r.user_id !== user,
        );
        if (!remaining.length) fail(409, "LAST_OWNER");
      }
      const m = await c.query(
        "SELECT status FROM org_membership WHERE organization_id=$1 AND user_id=$2 FOR SHARE",
        [ctx.org, user],
      );
      if (role !== "REMOVE" && m.rows[0]?.status !== "ACTIVE")
        fail(400, "INVALID_MEMBER");
      if (role === "REMOVE")
        await c.query(
          "DELETE FROM collab_grant WHERE organization_id=$1 AND document_id=$2 AND user_id=$3",
          [ctx.org, id, user],
        );
      else
        await c.query(
          "INSERT INTO collab_grant VALUES($1,$2,$3,$4) ON CONFLICT(document_id,user_id) DO UPDATE SET role=$4",
          [ctx.org, id, user, role],
        );
      await c.query(
        "UPDATE collab_document SET acl_epoch=acl_epoch+1 WHERE organization_id=$1 AND id=$2",
        [ctx.org, id],
      );
      await this.audit(
        c,
        ctx,
        id,
        "document:grant",
        { userId: user, role: existing?.role || null },
        { userId: user, role: role === "REMOVE" ? null : role },
      );
      return { ok: true };
    });
  }
  async ticket(ctx, id) {
    return this.tx(ctx, async (c) => {
      const d = await this.access(c, ctx, id);
      if(d.kind==='OFFICE')fail(409,'OFFICE_ENGINE_REQUIRED');
      const secret = randomBytes(32).toString("hex");
      await c.query(
        "DELETE FROM collab_ticket WHERE organization_id=$1 AND expires_at<now()",
        [ctx.org],
      );
      await c.query(
        "INSERT INTO collab_ticket(hash,organization_id,document_id,user_id,expires_at) VALUES($1,$2,$3,$4,now()+interval '60 seconds')",
        [hash(secret), ctx.org, id, ctx.user],
      );
      return {
        ticket: secret,
        docId: id,
        organizationId: ctx.org,
        role: d.role,
        user: { id: ctx.user, name: d.userName },
        protocolVersion: 1,
        expiresIn: 60,
      };
    });
  }
  async consume(ctx, id, secret) {
    if (typeof secret !== "string" || !/^[a-f0-9]{64}$/.test(secret))
      fail(401, "INVALID_TICKET");
    return this.tx(ctx, async (c) => {
      const d = await this.access(c, ctx, id);
      const r = await c.query(
        "UPDATE collab_ticket SET consumed_at=now() WHERE hash=$1 AND organization_id=$2 AND document_id=$3 AND user_id=$4 AND consumed_at IS NULL AND expires_at>now() RETURNING hash",
        [hash(secret), ctx.org, id, ctx.user],
      );
      if (!r.rowCount) fail(401, "INVALID_TICKET");
      const user=(await c.query("SELECT password_hash FROM sys_user WHERE id=$1",[ctx.user])).rows[0];
      return { role: d.role, name: d.userName, kind:d.kind,credentialState:hash(user.password_hash||"oauth-only") };
    });
  }
  async sync(ctx, id, vector) {
    const v = decoded(vector, 64 * 1024);
    return this.tx(ctx, async (c) => {
      const d = await this.access(c, ctx, id),
        doc = materialize(d.state);
      try {
        return {
          update: Buffer.from(Y.encodeStateAsUpdate(doc, v)).toString("base64"),
          seq: d.seq,
          role: d.role,
        };
      } finally {
        doc.destroy();
      }
    });
  }
  async update(ctx, id, input) {
    const updateId = uuid.parse(input.updateId),
      bytes = decoded(input.update),
      checksum = hash(bytes);
    if (!bytes.length) fail(400, "INVALID_UPDATE");
    return this.tx(ctx, async (c) => {
      const d = await this.access(c, ctx, id, "write");
      const old = (
        await c.query(
          "SELECT seq,checksum FROM collab_update WHERE organization_id=$1 AND document_id=$2 AND update_id=$3",
          [ctx.org, id, updateId],
        )
      ).rows[0];
      if (old) {
        if (old.checksum !== checksum) fail(409, "UPDATE_ID_REUSED");
        return { seq: old.seq, updateId, duplicate: true };
      }
      const doc = materialize(d.state);
      let state;
      try {
        Y.applyUpdate(doc, bytes);
        if (d.kind === "BOARD") checkBoard(doc);
        else if(d.kind==='MARKDOWN')checkMarkdown(doc);
        else await this.checkImages(c,ctx,id,doc);
        state = Buffer.from(Y.encodeStateAsUpdate(doc));
        if (state.length > 5 * 1024 * 1024) fail(413, "DOCUMENT_TOO_LARGE");
      } catch (e) {
        if (e instanceof StoreError) throw e;
        fail(400, "INVALID_UPDATE");
      } finally {
        doc.destroy();
      }
      const seq = (BigInt(d.seq) + 1n).toString();
      await c.query(
        "INSERT INTO collab_update(organization_id,document_id,update_id,seq,actor_id,checksum,bytes) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [ctx.org, id, updateId, seq, ctx.user, checksum, bytes],
      );
      await c.query(
        "UPDATE collab_document SET state=$1,seq=$2,updated_at=now() WHERE organization_id=$3 AND id=$4",
        [state, seq, ctx.org, id],
      );
      // Authorize the fan-out audience at the same database read/commit boundary.
      // One query replaces one full document rehydrate + transaction per socket.
      const readers = await this.readers(c, ctx, id);
      return { seq, updateId, readers };
    });
  }
  async audience(ctx, id) {
    return this.tx(ctx, async (c) => {
      await this.access(c, ctx, id);
      return this.readers(c, ctx, id);
    });
  }
  async updateBatch(id, items) {
    if (items.length === 1) {
      try {
        return [
          {
            ok: true,
            ...(await this.update(items[0].ctx, id, items[0].input)),
          },
        ];
      } catch (error) {
        return [{ ok: false, error }];
      }
    }
    const prepared = items.map((item) => {
      try {
        const updateId = uuid.parse(item.input.updateId),
          bytes = decoded(item.input.update);
        if (!bytes.length) fail(400, "INVALID_UPDATE");
        Y.decodeUpdate(bytes);
        return { ...item, updateId, bytes, checksum: hash(bytes) };
      } catch (error) {
        return {
          ...item,
          error:
            error instanceof StoreError
              ? error
              : new StoreError(400, "INVALID_UPDATE"),
        };
      }
    });
    const first = prepared.find((p) => !p.error);
    if (!first) return prepared.map((p) => ({ ok: false, error: p.error }));
    if (prepared.some((p) => p.ctx.org !== first.ctx.org))
      fail(400, "MIXED_TENANT_BATCH");
    try {
      return await this.tx(first.ctx, async (c) => {
        const permissions = new Map();
        let state;
        // Authorization is checked under the same parent/document locks for every
        // distinct actor. This cache lasts only for this commit, never a session.
        for (const p of prepared) {
          if (p.error || permissions.has(p.ctx.user)) continue;
          try {
            const d = await this.access(c, p.ctx, id, "write");
            permissions.set(p.ctx.user, d);
            state ??= d;
          } catch (e) {
            if (!(e instanceof StoreError)) throw e;
            permissions.set(p.ctx.user, e);
          }
        }
        if (!state)
          return prepared.map((p) => ({
            ok: false,
            error: p.error || permissions.get(p.ctx.user),
          }));
        const ids = prepared.filter((p) => !p.error).map((p) => p.updateId);
        const prior = (
          await c.query(
            "SELECT update_id,seq,checksum FROM collab_update WHERE organization_id=$1 AND document_id=$2 AND update_id=ANY($3::uuid[])",
            [first.ctx.org, id, ids],
          )
        ).rows;
        const receipts = new Map(
          prior.map((r) => [
            r.update_id,
            { seq: r.seq, checksum: r.checksum, committed: true },
          ]),
        );
        const doc = materialize(state.state),
          inserts = [],
          results = [];
        let seq = BigInt(state.seq);
        try {
          for (const p of prepared) {
            const permission = permissions.get(p.ctx.user);
            if (p.error || permission instanceof StoreError) {
              results.push({ ok: false, error: p.error || permission });
              continue;
            }
            const receipt = receipts.get(p.updateId);
            if (receipt) {
              results.push(
                receipt.checksum === p.checksum
                  ? {
                      ok: true,
                      seq: receipt.seq,
                      updateId: p.updateId,
                      duplicate: true,
                    }
                  : {
                      ok: false,
                      error: new StoreError(409, "UPDATE_ID_REUSED"),
                    },
              );
              continue;
            }
            Y.applyUpdate(doc, p.bytes);
            seq++;
            const next = {
              seq: seq.toString(),
              updateId: p.updateId,
              bytes: p.bytes,
              checksum: p.checksum,
              actor: p.ctx.user,
            };
            inserts.push(next);
            receipts.set(p.updateId, { seq: next.seq, checksum: p.checksum });
            results.push({ ok: true, seq: next.seq, updateId: p.updateId });
          }
          if (!inserts.length) return results;
          const encoded = Buffer.from(Y.encodeStateAsUpdate(doc));
          if (state.kind === "BOARD") {
            checkBoard(doc);
          } else if(state.kind==='MARKDOWN')checkMarkdown(doc);
          else await this.checkImages(c,first.ctx,id,doc);
          if (encoded.length > 5 * 1024 * 1024) fail(413, "DOCUMENT_TOO_LARGE");
          await c.query(
            `INSERT INTO collab_update(organization_id,document_id,update_id,seq,actor_id,checksum,bytes)
          SELECT $1,$2,u.id,u.seq,u.actor,u.checksum,u.bytes FROM unnest($3::uuid[],$4::bigint[],$5::text[],$6::text[],$7::bytea[]) AS u(id,seq,actor,checksum,bytes)`,
            [
              first.ctx.org,
              id,
              inserts.map((p) => p.updateId),
              inserts.map((p) => p.seq),
              inserts.map((p) => p.actor),
              inserts.map((p) => p.checksum),
              inserts.map((p) => p.bytes),
            ],
          );
          await c.query(
            "UPDATE collab_document SET state=$1,seq=$2,updated_at=now() WHERE organization_id=$3 AND id=$4",
            [encoded, seq.toString(), first.ctx.org, id],
          );
          const readers = await this.readers(c, first.ctx, id);
          return results.map((r) =>
            r.ok && !r.duplicate ? { ...r, readers } : r,
          );
        } finally {
          doc.destroy();
        }
      });
    } catch (error) {
      // A malformed edit must not poison unrelated actors sharing a batch.
      // Retry separately after the entire failed transaction rolled back.
      if (error instanceof StoreError && [400, 413].includes(error.status))
        return Promise.all(
          items.map(async (p) => {
            try {
              return { ok: true, ...(await this.update(p.ctx, id, p.input)) };
            } catch (e) {
              return { ok: false, error: e };
            }
          }),
        );
      throw error;
    }
  }
  async readers(c, ctx, id) {
    return (
      await c.query(
        `
        SELECT g.user_id,g.role,u.name,u.password_hash FROM collab_grant g
        JOIN org_membership m ON m.organization_id=g.organization_id AND m.user_id=g.user_id
        JOIN sys_user u ON u.id=g.user_id
        JOIN collab_document d ON d.organization_id=g.organization_id AND d.id=g.document_id
        JOIN prj_project p ON p.organization_id=d.organization_id AND p.id=d.project_id
        WHERE g.organization_id=$1 AND g.document_id=$2 AND m.status='ACTIVE' AND u.status='NORMAL'
        AND (p.visibility='ORGANIZATION' OR p.owner_id=g.user_id
          OR EXISTS(SELECT 1 FROM org_membership_role mr JOIN sys_role r ON r.id=mr.role_id
                    WHERE mr.membership_id=m.id AND r.status='NORMAL' AND r.role_key IN ('OWNER','ADMIN'))
          OR EXISTS(SELECT 1 FROM org_resource_grant rg JOIN org_collaboration_group cg ON cg.id=rg.group_id AND cg.organization_id=rg.organization_id
                    JOIN org_group_member gm ON gm.group_id=cg.id AND gm.organization_id=cg.organization_id
                    WHERE rg.organization_id=$1 AND rg.project_id=p.id AND gm.membership_id=m.id AND cg.archived_at IS NULL))`,
        [ctx.org, id],
      )
    ).rows.map(({password_hash,...r})=>({...r,credentialState:hash(password_hash||"oauth-only")}));
  }
  async threads(ctx, id) {
    return this.tx(ctx, async (c) => {
      await this.access(c, ctx, id);
      return (
        await c.query(
          "SELECT t.*,coalesce((SELECT json_agg(r ORDER BY r.created_at) FROM collab_reply r WHERE r.organization_id=$1 AND r.document_id=$2 AND r.thread_id=t.id),'[]') AS replies FROM collab_thread t WHERE t.organization_id=$1 AND t.document_id=$2 ORDER BY t.created_at DESC LIMIT 100",
          [ctx.org, id],
        )
      ).rows;
    });
  }
  async thread(ctx, id, input) {
    const parsed = z
      .object({
        id: uuid,
        body: text,
        quote: z.string().max(1000).default(""),
        anchor: z
          .object({ start: z.string().max(2000), end: z.string().max(2000) })
          .nullable()
          .default(null),
      })
      .strict()
      .parse(input);
    return this.tx(ctx, async (c) => {
      await this.access(c, ctx, id, "comment");
      const old = (
        await c.query(
          "SELECT * FROM collab_thread WHERE id=$1 AND organization_id=$2 AND document_id=$3",
          [parsed.id, ctx.org, id],
        )
      ).rows[0];
      if (old) {
        if (
          old.created_by !== ctx.user ||
          old.body !== parsed.body ||
          old.quote !== parsed.quote ||
          !isDeepStrictEqual(old.anchor, parsed.anchor)
        )
          fail(409, "IDEMPOTENCY_CONFLICT");
        return old;
      }
      const r = await c.query(
        "INSERT INTO collab_thread(id,organization_id,document_id,body,quote,anchor,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [
          parsed.id,
          ctx.org,
          id,
          parsed.body,
          parsed.quote,
          parsed.anchor,
          ctx.user,
        ],
      );
      await this.audit(c, ctx, id, "document:comment", null, {
        threadId: parsed.id,
        anchored: !!parsed.anchor,
        resolved: false,
      });
      return r.rows[0];
    });
  }
  async resolve(ctx, id, thread, input) {
    const revision = z.number().int().positive().parse(input.revision),
      resolved = z.boolean().parse(input.resolved);
    return this.tx(ctx, async (c) => {
      await this.access(c, ctx, id, "comment");
      const r = await c.query(
        "UPDATE collab_thread SET resolved=$1,revision=revision+1 WHERE organization_id=$2 AND document_id=$3 AND id=$4 AND revision=$5 RETURNING *",
        [resolved, ctx.org, id, uuid.parse(thread), revision],
      );
      if (!r.rowCount) fail(409, "REVISION_CONFLICT");
      await this.audit(
        c,
        ctx,
        id,
        "document:resolve",
        { threadId: thread, revision },
        { threadId: thread, revision: revision + 1, resolved },
      );
      return r.rows[0];
    });
  }
  async reply(ctx, id, thread, input) {
    const key = uuid.parse(input.id),
      body = text.parse(input.body);
    return this.tx(ctx, async (c) => {
      await this.access(c, ctx, id, "comment");
      const r = await c.query(
        "INSERT INTO collab_reply(id,organization_id,document_id,thread_id,body,created_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING RETURNING *",
        [key, ctx.org, id, uuid.parse(thread), body, ctx.user],
      );
      if (r.rowCount) {
        await this.audit(c, ctx, id, "document:reply", null, {
          threadId: thread,
          replyId: key,
        });
        return r.rows[0];
      }
      const old = (
        await c.query(
          "SELECT * FROM collab_reply WHERE id=$1 AND organization_id=$2 AND document_id=$3 AND thread_id=$4",
          [key, ctx.org, id, thread],
        )
      ).rows[0];
      if (!old || old.body !== body || old.created_by !== ctx.user)
        fail(409, "IDEMPOTENCY_CONFLICT");
      return old;
    });
  }
  async versions(ctx, id) {
    return this.tx(ctx, async (c) => {
      await this.access(c, ctx, id);
      return (
        await c.query(
          "SELECT id,name,seq,created_by,created_at FROM collab_version WHERE organization_id=$1 AND document_id=$2 ORDER BY created_at DESC LIMIT 100",
          [ctx.org, id],
        )
      ).rows;
    });
  }
  async version(ctx, id, input) {
    const key = uuid.parse(input.id),
      name = title.parse(input.name);
    return this.tx(ctx, async (c) => {
      const d = await this.access(c, ctx, id, "write");
      if(d.kind==='OFFICE')fail(409,'OFFICE_ENGINE_REQUIRED');
      const old = (
        await c.query(
          "SELECT id,name,seq,created_by FROM collab_version WHERE organization_id=$1 AND document_id=$2 AND id=$3",
          [ctx.org, id, key],
        )
      ).rows[0];
      if (old) {
        if (old.name !== name || old.created_by !== ctx.user)
          fail(409, "IDEMPOTENCY_CONFLICT");
        return old;
      }
      await c.query(
        "INSERT INTO collab_version VALUES($1,$2,$3,$4,$5,$6,$7,now())",
        [key, ctx.org, id, name, d.seq, d.state, ctx.user],
      );
      await this.audit(c, ctx, id, "document:version", null, {
        versionId: key,
        seq: d.seq,
      });
      return { id: key, name, seq: d.seq };
    });
  }
  async preview(ctx, id, version) {
    return this.tx(ctx, async (c) => {
      await this.access(c, ctx, id);
      const v = (
        await c.query(
          "SELECT * FROM collab_version WHERE organization_id=$1 AND document_id=$2 AND id=$3",
          [ctx.org, id, uuid.parse(version)],
        )
      ).rows[0];
      if (!v) fail(404, "NOT_FOUND");
      return { ...v, state: v.state.toString("base64") };
    });
  }
  async restore(ctx, id, version, input) {
    const key = uuid.parse(input.id);
    return this.tx(ctx, async (c) => {
      const d = await this.access(c, ctx, id, "write");
      if(d.kind==='OFFICE')fail(409,'OFFICE_ENGINE_REQUIRED');
      const prior = (
        await c.query(
          "SELECT * FROM collab_restore WHERE organization_id=$1 AND id=$2",
          [ctx.org, key],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.document_id !== id ||
          prior.version_id !== version ||
          prior.actor_id !== ctx.user
        )
          fail(409, "IDEMPOTENCY_CONFLICT");
        return this.meta(await this.access(c, ctx, prior.result_id));
      }
      const v = (
        await c.query(
          "SELECT * FROM collab_version WHERE organization_id=$1 AND document_id=$2 AND id=$3",
          [ctx.org, id, uuid.parse(version)],
        )
      ).rows[0];
      if (!v) fail(404, "NOT_FOUND");
      const result = await this.insert(
        c,
        ctx,
        d.project_id,
        `${d.title.slice(0, 130)} · 恢复副本`,
        copyContent(v.state, d.kind),
        d.kind,
      );
      if(d.kind==="DOCUMENT") {
        const snapshot=materialize(v.state);
        try {
          const ids=imageIds(snapshot);
          if(ids.length) {
            const copied=await c.query("INSERT INTO collab_image(organization_id,document_id,id,mime,bytes,created_by) SELECT organization_id,$3,id,mime,bytes,$4 FROM collab_image WHERE organization_id=$1 AND document_id=$2 AND id=ANY($5::uuid[])",[ctx.org,id,result.id,ctx.user,ids]);
            if(copied.rowCount!==ids.length) fail(409,"IMAGE_MISSING");
          }
        } finally {snapshot.destroy();}
      }
      await c.query("INSERT INTO collab_restore VALUES($1,$2,$3,$4,$5,$6)", [
        key,
        ctx.org,
        id,
        version,
        ctx.user,
        result.id,
      ]);
      await this.audit(
        c,
        ctx,
        id,
        "document:restore-copy",
        { versionId: version },
        { versionId: version, resultId: result.id },
      );
      return result;
    });
  }
}
module.exports = { Store, StoreError, decoded, materialize, copyContent };
