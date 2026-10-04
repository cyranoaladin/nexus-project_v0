import subprocess, os, json, secrets, time, hashlib, argparse, re
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from pathlib import Path
from urllib.parse import quote, urlunsplit
parser=argparse.ArgumentParser(description='Disposable synthetic PostgreSQL expansion/restore rehearsal; never uses a supplied database URL')
parser.add_argument('--old-ref',required=True)
args=parser.parse_args()
if not re.fullmatch(r'[a-f0-9]{40}',args.old_ref): raise SystemExit('OLD_COMMIT_SHA_REQUIRED')
if subprocess.run(['git','merge-base','--is-ancestor',args.old_ref,'HEAD'],capture_output=True).returncode: raise SystemExit('OLD_REF_NOT_ANCESTOR')
root=Path.cwd(); out=root/'.artifacts/recovery'/('stage-lead-decision-green-'+str(int(time.time())))
out.mkdir(mode=0o700)
name='nexus-stage-lead-decision-pgvector-20261004-'+str(int(time.time()))
image='pgvector/pgvector@sha256:ccc6e83d6e35e931dc7c5def2022729d5a6c370318d099181995567ff1fb4d6b'
password=secrets.token_hex(32); env=os.environ.copy(); env['POSTGRES_PASSWORD']=password
if '20261004214500_stage_reservation_decision_audit' in subprocess.check_output(['git','ls-tree','-d','--name-only',args.old_ref+':prisma/migrations'],text=True).splitlines(): raise SystemExit('OLD_REF_ALREADY_HAS_NEW_MIGRATION')
p=subprocess.run(['docker','run','--rm','-d','--name',name,'--label','nexus.recovery.owner=stage-lead-decision-rehearsal','--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,size=768m','-p','127.0.0.1::5432','-e','POSTGRES_PASSWORD','-e','POSTGRES_DB=nexus_disposable_owner_test',image],env=env,capture_output=True)
if p.returncode: raise SystemExit('DISPOSABLE_CREATE_FAILED')
try:
 for attempt in range(100):
  p=subprocess.run(['docker','exec',name,'pg_isready','-U','postgres'],capture_output=True)
  if p.returncode==0: break
  time.sleep(.2)
 else: raise RuntimeError('DISPOSABLE_READINESS_FAILED')
 info=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
 assert info['Config']['Labels']['nexus.recovery.owner']=='stage-lead-decision-rehearsal'
 assert '/var/lib/postgresql/data' in info['HostConfig']['Tmpfs']
 port=info['NetworkSettings']['Ports']['5432/tcp'][0]['HostPort']
 # Encode credentials as URL components; no literal or inherited DSN is used.
 url=urlunsplit(('postgresql', f'postgres:{quote(password, safe="")}@127.0.0.1:{port}', '/nexus_disposable_owner_test', '', ''))
 env=os.environ.copy(); env['DATABASE_URL']=url;env['TEST_DATABASE_URL']=url;env['NODE_ENV']='test';env['NEXUS_DISPOSABLE_POSTGRES']='1'
 snapshot=out/'old-schema'; (snapshot/'migrations').mkdir(parents=True,mode=0o700)
 old_schema=subprocess.check_output(['git','show',args.old_ref+':prisma/schema.prisma'])
 (snapshot/'schema.prisma').write_bytes(old_schema)
 migration_dirs=subprocess.check_output(['git','ls-tree','-d','--name-only',args.old_ref+':prisma/migrations'],text=True).splitlines()
 for entry in migration_dirs:
  assert '/' not in entry and entry not in ('.','..')
  historical_sql=subprocess.check_output(['git','show',args.old_ref+':prisma/migrations/'+entry+'/migration.sql'])
  if historical_sql != (root/'prisma/migrations'/entry/'migration.sql').read_bytes():
   raise RuntimeError('HISTORICAL_MIGRATION_BYTES_CHANGED')
  (snapshot/'migrations'/entry).mkdir(mode=0o700)
  (snapshot/'migrations'/entry/'migration.sql').symlink_to(root/'prisma/migrations'/entry/'migration.sql')
 (snapshot/'migrations'/'migration_lock.toml').write_bytes((root/'prisma/migrations/migration_lock.toml').read_bytes())
 def run_private(label,args,task_env=env):
  with open(out/(label+'.log'),'w') as log:
   result=subprocess.run(args,env=task_env,stdout=log,stderr=subprocess.STDOUT)
  if result.returncode: raise RuntimeError(label.upper()+'_FAILED')
 fixture=['npx','--no-install','tsx','__tests__/helpers/stage-decision-migration-fixture.ts']
 hash_path=str(out/'old-row.sha256')
 run_private('old-schema-deploy',['npx','--no-install','prisma','migrate','deploy','--schema',str(snapshot/'schema.prisma')])
 run_private('old-schema-seed',fixture+['seed',hash_path])
 dump=subprocess.run(['docker','exec',name,'pg_dump','-U','postgres','-d','nexus_disposable_owner_test','-Fc'],capture_output=True,check=True).stdout
 key=AESGCM.generate_key(bit_length=256); nonce=secrets.token_bytes(12)
 encrypted=nonce+AESGCM(key).encrypt(nonce,dump,b'synthetic-stage-migration-fixture')
 backup=out/'synthetic-old-schema-backup.aes-gcm'; backup.write_bytes(encrypted); backup.chmod(0o600)
 subprocess.run(['docker','exec',name,'createdb','-U','postgres','nexus_disposable_stage_restore_test'],capture_output=True,check=True)
 restored=AESGCM(key).decrypt(encrypted[:12],encrypted[12:],b'synthetic-stage-migration-fixture')
 subprocess.run(['docker','exec','-i',name,'pg_restore','-U','postgres','--no-owner','--no-privileges','-d','nexus_disposable_stage_restore_test'],input=restored,capture_output=True,check=True)
 env['DATABASE_URL']=url.rsplit('/',1)[0]+'/nexus_disposable_stage_restore_test'; env['TEST_DATABASE_URL']=env['DATABASE_URL']
 run_private('restored-old-schema-verification',fixture+['verify-old',hash_path])
 run_private('interrupted-ddl-connection',fixture+['interrupt',hash_path])
 run_private('current-schema-validation',['npx','--no-install','prisma','validate'])
 run_private('expanded-schema-deploy',['npx','--no-install','prisma','migrate','deploy'])
 run_private('expanded-schema-old-rows',fixture+['verify-new',hash_path])
 run_private('expanded-schema-replay',['npx','--no-install','prisma','migrate','deploy'])
 run_private('account-fk-manifest-check',['npx','--no-install','tsx','scripts/db/check-account-deletion-fk-manifest.ts'])
 (out/'synthetic-backup-metadata.json').write_text(json.dumps({'scope':'synthetic fixture only; not a production backup', 'oldSourceSha':args.old_ref, 'oldMigrationCount':len(migration_dirs), 'ciphertextBytes':len(encrypted),'sha256':hashlib.sha256(encrypted).hexdigest(),'keyCustody':'ephemeral process RAM only; not a durable backup','retention':'reproducible synthetic fixture; no client data; proof artifact retained locally'},indent=2))
 print('SYNTHETIC_ENCRYPTED_RESTORE_VERIFIED=1;INTERRUPTED_DDL_ROLLBACK_VERIFIED=1')
 with open(out/'stage-list-real-tests-private.log','w') as f:
  p=subprocess.run(['npm','run','test:integration','--','--testPathPatterns=stage-lead-decision.real'],env=env,stdout=f,stderr=subprocess.STDOUT)
 print('REAL_DATABASE_TEST_EXIT='+str(p.returncode))
 print('PRIVATE_PROOF_DIRECTORY='+str(out))
 if p.returncode: raise RuntimeError('REAL_TEST_FAILED')
finally:
 info=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
 assert info['Config']['Labels']['nexus.recovery.owner']=='stage-lead-decision-rehearsal'
 assert '/var/lib/postgresql/data' in info['HostConfig']['Tmpfs']
 subprocess.run(['docker','stop',name],capture_output=True,check=True)
 print('OWNED_TMPFS_INSTANCE_STOPPED')
