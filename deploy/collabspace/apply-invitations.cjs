/* ADMIN_DATABASE_URL and DATABASE_URL are supplied privately; no credentials logged. */
const fs=require('node:fs'),{createRequire}=require('node:module'),path=require('node:path');
const {Client}=createRequire(path.resolve(__dirname,'../../packages/collab-store/package.json'))('pg');
async function apply(adminUrl,runtimeUrl){
 const admin=new Client({connectionString:adminUrl}),runtime=new Client({connectionString:runtimeUrl});
 try{await admin.connect();await runtime.connect();
 const a=(await admin.query('SELECT rolsuper FROM pg_roles WHERE rolname=current_user')).rows[0];
 const r=(await runtime.query('SELECT current_user AS name,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
 if(!a?.rolsuper||!r||r.rolsuper||r.rolbypassrls||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(r.name))throw Error('Migration requires administrator and nonprivileged runtime role');
 const sql=fs.readFileSync(require('node:path').join(__dirname,'2026-10-23-invitations.sql'),'utf8');
 const split=sql.indexOf('CREATE INDEX');
 await admin.query(sql.slice(0,split));
 await admin.query('BEGIN');
 try{await admin.query(sql.slice(split));const role='"'+r.name+'"';
 await admin.query(`REVOKE ALL ON personal_notification FROM ${role}; GRANT SELECT,UPDATE(read_at) ON personal_notification TO ${role}; GRANT SELECT,INSERT,UPDATE,DELETE ON invitation_delivery TO ${role}; GRANT EXECUTE ON FUNCTION public.invitation_notify(text,text),public.invitation_sync_inbox() TO ${role}`);
 await admin.query('COMMIT');}catch(e){await admin.query('ROLLBACK');throw e;}
 console.log('Invitation schema and recipient RLS applied');
 }finally{await Promise.allSettled([admin.end(),runtime.end()]);}
}
module.exports={apply};
if(require.main===module)apply(process.env.ADMIN_DATABASE_URL,process.env.DATABASE_URL).catch(e=>{console.error(e.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]'));process.exitCode=1;});
