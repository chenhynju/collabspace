const { Pool } = require('../packages/collab-store/node_modules/pg');
const { mkdirSync, writeFileSync } = require('node:fs');
(async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_ADMIN_URL});
 try {
  const users=(await pool.query("SELECT id,email FROM sys_user WHERE email IN ('owner@acme.dev','member@acme.dev','owner@globex.dev')")).rows;
  const orgs=(await pool.query("SELECT id,slug FROM org_organization WHERE slug IN ('acme','globex')")).rows;
  const org=orgs.find(o=>o.slug==='acme').id,other=orgs.find(o=>o.slug==='globex').id;
  const project=(await pool.query("SELECT id FROM prj_project WHERE organization_id=$1 AND status<>'ARCHIVED' LIMIT 1",[org])).rows[0].id;
  const config={DATABASE_URL:process.env.DATABASE_URL,DATABASE_ADMIN_URL:process.env.DATABASE_ADMIN_URL,COLLAB_TEST_DATABASE_URL:process.env.DATABASE_URL,TEST_ORG:org,TEST_OTHER_ORG:other,TEST_PROJECT:project,TEST_OWNER:users.find(u=>u.email==='owner@acme.dev').id,TEST_MEMBER:users.find(u=>u.email==='member@acme.dev').id,TEST_OTHER_USER:users.find(u=>u.email==='owner@globex.dev').id};
  mkdirSync('.test-runs/collab-local',{recursive:true});writeFileSync('.test-runs/collab-local/config.json',JSON.stringify(config,null,2));
 } finally {await pool.end();}
})().catch(e=>{console.error(e);process.exitCode=1;});
