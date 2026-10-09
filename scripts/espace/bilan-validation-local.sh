#!/usr/bin/env bash
# Disposable LOCAL harness. Never reads production credentials or contacts production.
set -Eeuo pipefail
PROJECT=$(cd "$(dirname "$0")/../.." && pwd)
STATE=${BILAN_VALIDATION_STATE:-"${XDG_STATE_HOME:-$HOME/.local/state}/nexus-bilan-validation"}
NODE_BIN=${BILAN_NODE_BIN:-"$HOME/.nvm/versions/node/v22.23.1/bin"}
export PATH="$NODE_BIN:$PATH"
export BILAN_VALIDATION_STATE="$STATE"
mkdir -p "$STATE"
chmod 700 "$STATE"
cd "$PROJECT"
case "${1:-}" in
  up)
    [ ! -e "$STATE/runtime.env" ] || { echo "Existing harness: use status/down first ($STATE)"; exit 64; }
    [ "$(node -v)" = v22.23.1 ] || { echo 'Node v22.23.1 required'; exit 64; }
    python3 - "$STATE" "$PROJECT" <<'PY'
import os,pathlib,secrets,shlex,subprocess,sys,time
p=pathlib.Path(sys.argv[1]); project=pathlib.Path(sys.argv[2]); suffix=secrets.token_hex(6)
import socket
with socket.socket() as check:
 try:check.bind(('127.0.0.1',3017))
 except OSError:raise RuntimeError('Port 3017 already in use; refusing to attach to an unknown server')
name='nexus-bilan-validation-'+suffix; db='nexus_disposable_bilan_'+suffix+'_test'; password=secrets.token_hex(24)
docker_env=p/'postgres.env'
db_env={'POSTGRES_USER':'nexus_bilan_test','POSTGRES_PASSWORD':password,'POSTGRES_DB':db}
docker_env.write_text(''.join(f'{key}={value}\n' for key,value in db_env.items()));docker_env.chmod(0o600)
subprocess.run(['docker','run','-d','--name',name,'--env-file',str(docker_env),'--publish','127.0.0.1::5432','--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,size=512m','--health-cmd','pg_isready -U nexus_bilan_test -d '+db,'--health-interval','1s','--health-retries','30','pgvector/pgvector@sha256:a947c45cdc5906a1bc951f20a8709e321256343ee0f251e4ae00b5e7def4e6da'],check=True,stdout=subprocess.DEVNULL)  # pg15, registre .github/governance/container-images.json
(p/'container').write_text(name)
port=subprocess.check_output(['docker','port',name,'5432/tcp'],text=True).strip().rsplit(':',1)[1]
redis_name=name+'-redis'
subprocess.run(['docker','run','-d','--name',redis_name,'--publish','127.0.0.1::6379','redis@sha256:ff02b58f971e7d7d156a1267e283fcbbeee91773b6aa36c49dac28ecfe28eadf','redis-server','--save','','--appendonly','no'],check=True,stdout=subprocess.DEVNULL)  # 7-alpine, registre .github/governance/container-images.json
(p/'redis-container').write_text(redis_name)
redis_port=subprocess.check_output(['docker','port',redis_name,'6379/tcp'],text=True).strip().rsplit(':',1)[1]
url='postgresql://nexus_bilan_test:'+password+'@127.0.0.1:'+port+'/'+db+'?schema=public'
for directory in ['npc','documents']:(p/directory).mkdir(mode=0o700,exist_ok=True)
env={'DATABASE_URL':url,'TEST_DATABASE_URL':url,'NEXUS_DISPOSABLE_POSTGRES':'1','BILAN_VALIDATION_LOCAL':'1','BILAN_VALIDATION_BASE_URL':'http://127.0.0.1:3017','NEXTAUTH_URL':'http://127.0.0.1:3017','NEXT_PUBLIC_APP_URL':'http://127.0.0.1:3017','NEXTAUTH_SECRET':secrets.token_hex(32),'RATE_LIMIT_BACKEND':'redis','REDIS_URL':'redis://127.0.0.1:6383','RATE_LIMIT_KEY_SECRET':secrets.token_hex(32),'RATE_LIMIT_KEY_NAMESPACE':name,'RATE_LIMIT_TRUST_PROXY_HOPS':'1','DOCUMENT_STORAGE_ROOT':str(p/'documents'),'NPC_STORAGE_ROOT':str(p/'npc'),'EMAIL_OUTBOX_ENCRYPTION_KEY':secrets.token_hex(32),'EMAIL_OUTBOX_WORKER_ENABLED':'false','ARIA_TURN_RECOVERY_WORKER_ENABLED':'false','BILAN_WORKER_ENABLED':'false','MAIL_DISABLED':'true','CORE_V2_AUTH_MODE':'V1_ONLY','NEXUS_ORGANIZATION_TIMEZONE':'Africa/Tunis','NODE_OPTIONS':'--max-old-space-size=6144'}
env['REDIS_URL']='redis://127.0.0.1:'+redis_port
env['RATE_LIMIT_KEY_NAMESPACE']='bilan-'+suffix
f=p/'runtime.env';f.write_text(''.join(k+'='+shlex.quote(v)+'\n' for k,v in env.items()));f.chmod(0o600)
for _ in range(40):
 if subprocess.check_output(['docker','inspect','--format','{{.State.Health.Status}}',name],text=True).strip()=='healthy':break
 time.sleep(1)
else:raise RuntimeError('Disposable Postgres not healthy')
print('DISPOSABLE_DB_READY '+name+' localhost:'+port)
PY
    set -a; . "$STATE/runtime.env"; set +a
    npx prisma migrate deploy > "$STATE/migrations.log" 2>&1
    python3 - "$STATE" "$PROJECT" <<'PY'
import os,pathlib,subprocess,sys
p=pathlib.Path(sys.argv[1]);project=sys.argv[2]
with (p/'server.log').open('ab') as log:
 child=subprocess.Popen(['node','node_modules/next/dist/bin/next','dev','--port','3017','--hostname','127.0.0.1'],cwd=project,env=os.environ,stdout=log,stderr=log,start_new_session=True)
 (p/'server.pid').write_text(str(child.pid))
PY
    for _ in $(seq 1 60); do
      if curl --max-time 2 -fsS -o /dev/null http://127.0.0.1:3017/espace/connexion 2>/dev/null; then
        echo "HARNESS_READY http://127.0.0.1:3017 ENV=$STATE/runtime.env"; exit 0
      fi
      sleep 1
    done
    echo "Preview did not become ready; inspect $STATE/server.log"; exit 1
    ;;
  test)
    set -a; . "$STATE/runtime.env"; set +a
    shift
    npx playwright test -c playwright.bilan-validation.config.ts "$@"
    ;;
  status)
    [ -f "$STATE/container" ] && docker ps -a --filter "name=^/$(cat "$STATE/container")$" --format '{{.Names}} {{.Status}}'
    curl --max-time 3 -s -o /dev/null -w 'HTTP=%{http_code}\n' http://127.0.0.1:3017/espace/connexion
    ;;
  down)
    python3 - "$STATE" <<'PY'
import os,pathlib,re,signal,subprocess,sys,time
p=pathlib.Path(sys.argv[1]);pidfile=p/'server.pid'
if pidfile.exists():
 pid=int(pidfile.read_text());proc=pathlib.Path('/proc')/str(pid)/'cmdline'
 if proc.exists():
  command=proc.read_bytes()
  if b'next' not in command or b'3017' not in command:raise RuntimeError('Unexpected server process; refusing to stop')
  os.killpg(pid,signal.SIGTERM)
 pidfile.unlink()
f=p/'container'
if f.exists():
 name=f.read_text().strip()
 if not re.fullmatch(r'nexus-bilan-validation-[0-9a-f]{12}',name):raise RuntimeError('Unexpected container; refusing removal')
 subprocess.run(['docker','rm','-f','-v',name],check=True)
 f.rename(p/'container.removed')
rf=p/'redis-container'
if rf.exists():
 name=rf.read_text().strip()
 if not re.fullmatch(r'nexus-bilan-validation-[0-9a-f]{12}-redis',name):raise RuntimeError('Unexpected Redis container; refusing removal')
 subprocess.run(['docker','rm','-f','-v',name],check=True)
 rf.rename(p/'redis-container.removed')
env=p/'runtime.env'
if env.exists():env.rename(p/'runtime.env.stopped')
print('HARNESS_STOPPED (logs retained)')
PY
    ;;
  *) echo 'Usage: bilan-validation-local.sh up|test [playwright arguments]|status|down'; exit 64;;
esac
