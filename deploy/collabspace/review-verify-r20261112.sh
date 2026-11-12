set -eu
stage=/opt/collabspace/shared/review-r20261112-01
test "$(docker inspect collabspace-api-1 --format '{{.Image}}')" = "$(cat "$stage/API_IMAGE_ID")"
test "$(docker inspect collabspace-collab-1 --format '{{.Image}}')" = "$(cat "$stage/WS_IMAGE_ID")"
curl -fsS --max-time 5 http://127.0.0.1:3321/api/v1/health/ready
curl -fsS --max-time 5 http://127.0.0.1:3322/health/ready
docker exec collabspace-api-1 node -e 'const{Store}=require("@collabspace/store");const s=new Store();(async()=>{await s.assertRuntime();const r=await s.pool.query("SELECT NOT rolsuper AND NOT rolbypassrls AS nonprivileged FROM pg_roles WHERE rolname=current_user");if(!r.rows[0].nonprivileged)throw Error("Unsafe role");const t=await s.pool.query("SELECT relname,relrowsecurity AND relforcerowsecurity AS forced_rls FROM pg_class WHERE relname IN (\u0027rtc_meeting\u0027,\u0027rtc_message\u0027)");if(t.rows.length!==2||t.rows.some(x=>!x.forced_rls))throw Error("Meeting RLS missing");const c=await s.pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema=\u0027public\u0027 AND (table_name=\u0027collab_version\u0027 AND column_name=\u0027source\u0027 OR table_name=\u0027voice_job\u0027 AND column_name=\u0027speech_route\u0027)");if(c.rows.length!==2)throw Error("Columns missing");if(process.env.MEETINGS_ENABLED!=="false")throw Error("Meeting configuration changed");const{requireJwtSecret}=require("./dist/modules/auth/jwt-secret");let ok=false;try{requireJwtSecret({get:()=>undefined})}catch(e){ok=/JWT_SECRET/.test(e.message)}if(!ok)throw Error("JWT fail-fast missing in runtime");console.log(JSON.stringify({nonprivileged:true,collabRuntimeGate:true,meetingRls:t.rows,additiveColumns:true,meetingsEnabled:false,jwtFailFast:true}));})().finally(()=>s.close()).catch(()=>{console.error("Runtime verification failed");process.exitCode=1})'
test "$(stat -c %a "$stage/before-review.dump")" = 600
test "$(stat -c %a "$stage/before-uploads.tgz")" = 600
test "$(stat -c %a "$stage/native-ws.json")" = 600
cd "$stage"
sha256sum -c before-uploads.sha256
docker inspect collabspace-api-1 collabspace-collab-1 --format '{{.Name}} {{.Image}} OOM={{.State.OOMKilled}} restarts={{.RestartCount}}'
