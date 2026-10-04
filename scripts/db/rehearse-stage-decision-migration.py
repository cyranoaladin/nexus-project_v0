import subprocess, os, json, secrets, time, hashlib, argparse, re
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from pathlib import Path
from urllib.parse import quote, urlunsplit
parser=argparse.ArgumentParser(description='Disposable synthetic PostgreSQL expansion/restore rehearsal; never uses a supplied database URL')
parser.add_argument('--old-ref',required=True)
parser.add_argument('--include-staff-list',action='store_true',help='Also verify staff-list pagination against the restored disposable database')
parser.add_argument('--include-public-reservations',action='store_true',help='Also verify public lead/outbox atomicity against the restored disposable database')
parser.add_argument('--include-core-account-handoff',action='store_true',help='Also verify account handoff on a distinct disposable Core database')
parser.add_argument('--include-core-account-foundations',action='store_true',help='Also run related real-Core account and HTTP suites with aggregate-only logs')
args=parser.parse_args()
if args.include_core_account_foundations and not args.include_core_account_handoff: raise SystemExit('CORE_HANDOFF_REHEARSAL_REQUIRED')
if not re.fullmatch(r'[a-f0-9]{40}',args.old_ref): raise SystemExit('OLD_COMMIT_SHA_REQUIRED')
if subprocess.run(['git','merge-base','--is-ancestor',args.old_ref,'HEAD'],capture_output=True).returncode: raise SystemExit('OLD_REF_NOT_ANCESTOR')
root=Path.cwd(); out=root/'.artifacts/recovery'/('stage-lead-decision-green-'+str(int(time.time())))
out.mkdir(mode=0o700)
def source_identity():
 paths=[
  'lib/core-v2/services/account.ts', 'lib/core-v2/audit.ts',
  'lib/core-v2/accounts/email-handoff-worker.ts', 'lib/core-v2/accounts/email-handoff-destination.ts',
  'lib/email/account-handoff-envelope.ts', 'lib/email/core-v2-invitation.ts', 'lib/email/core-v2-password-reset.ts',
  'core-v2/prisma/schema.prisma', 'core-v2/prisma/migrations/0024_core_v2_account_email_handoff/migration.sql',
  '__tests__/core-v2/services/account-email-handoff.test.ts',
  '__tests__/core-v2/services/account-email-handoff-destination.test.ts',
  '__tests__/core-v2/helpers/account-handoff-migration-fixture.ts',
  '__tests__/setup/core-v2-token-env.js', 'scripts/db/rehearse-stage-decision-migration.py',
 ]
 return {
  'head_sha':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
  'old_reference_sha':args.old_ref,
  'tracked_diff_sha256':hashlib.sha256(subprocess.check_output(['git','diff','HEAD','--binary'])).hexdigest(),
  'source_files':{path:hashlib.sha256((root/path).read_bytes()).hexdigest() for path in paths if (root/path).is_file()},
 }
source_before=source_identity()
(out/'source-manifest.json').write_text(json.dumps(source_before,sort_keys=True,indent=2)+'\n')
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
 env['EMAIL_OUTBOX_WORKER_ENABLED']='false';env['EMAIL_OUTBOX_ENCRYPTION_KEY']=secrets.token_hex(32)
 env['INTERNAL_NOTIFICATION_EMAIL']='synthetic-internal@example.test'
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
  pattern='stage-lead-decision.real|reservation-staff-list.real' if args.include_staff_list else 'stage-lead-decision.real'
  if args.include_public_reservations: pattern+='|public-reservation-integrity.real'
  p=subprocess.run(['npm','run','test:integration','--','--testPathPatterns='+pattern],env=env,stdout=f,stderr=subprocess.STDOUT)
 print('REAL_DATABASE_TEST_EXIT='+str(p.returncode))
 print('PRIVATE_PROOF_DIRECTORY='+str(out))
 if p.returncode: raise RuntimeError('REAL_TEST_FAILED')
 if args.include_core_account_handoff:
  subprocess.run(['docker','exec',name,'createdb','-U','postgres','nexus_disposable_core_account_handoff_test'],capture_output=True,check=True)
  core_env=env.copy(); core_env['CORE_V2_DATABASE_URL']=url.rsplit('/',1)[0]+'/nexus_disposable_core_account_handoff_test'
  core_env['CORE_V2_AUTH_MODE']='HYBRID';core_env['CORE_V2_ACCOUNT_TOKEN_HMAC_CURRENT_KEY_ID']='synthetic-handoff-key'
  core_env['CORE_V2_ACCOUNT_TOKEN_HMAC_KEYS']=json.dumps({'synthetic-handoff-key':secrets.token_hex(32)})
  for key_name in ['ACCOUNT_EMAIL_HANDOFF_ENCRYPTION_CURRENT_KEY_ID','ACCOUNT_EMAIL_HANDOFF_ENCRYPTION_KEYS']: core_env.pop(key_name,None)
  core_snapshot=out/'old-core-schema'; (core_snapshot/'migrations').mkdir(parents=True,mode=0o700)
  (core_snapshot/'schema.prisma').write_bytes(subprocess.check_output(['git','show',args.old_ref+':core-v2/prisma/schema.prisma']))
  core_migrations=subprocess.check_output(['git','ls-tree','-d','--name-only',args.old_ref+':core-v2/prisma/migrations'],text=True).splitlines()
  if '0024_core_v2_account_email_handoff' in core_migrations: raise RuntimeError('OLD_CORE_REF_ALREADY_HAS_HANDOFF')
  for entry in core_migrations:
   assert '/' not in entry and entry not in ('.','..')
   source=root/'core-v2/prisma/migrations'/entry/'migration.sql'
   if source.read_bytes()!=subprocess.check_output(['git','show',args.old_ref+':core-v2/prisma/migrations/'+entry+'/migration.sql']): raise RuntimeError('OLD_CORE_MIGRATION_BYTES_CHANGED')
   (core_snapshot/'migrations'/entry).mkdir(mode=0o700)
   (core_snapshot/'migrations'/entry/'migration.sql').symlink_to(source)
  (core_snapshot/'migrations'/'migration_lock.toml').write_bytes((root/'core-v2/prisma/migrations/migration_lock.toml').read_bytes())
  run_private('core-old-schema-deploy',['npx','--no-install','prisma','migrate','deploy','--schema='+str(core_snapshot/'schema.prisma')],core_env)
  core_fixture=['npx','--no-install','tsx','__tests__/core-v2/helpers/account-handoff-migration-fixture.ts']
  core_hash=str(out/'old-core-native-rows.sha256')
  run_private('core-old-native-seed',core_fixture+['seed',core_hash],core_env)
  run_private('core-interrupted-ddl',core_fixture+['interrupt',core_hash],core_env)
  run_private('core-handoff-schema-deploy',['npx','--no-install','prisma','migrate','deploy','--schema=core-v2/prisma/schema.prisma'],core_env)
  run_private('core-expanded-native-rows',core_fixture+['verify',core_hash],core_env)
  run_private('core-expanded-schema-replay',['npx','--no-install','prisma','migrate','deploy','--schema=core-v2/prisma/schema.prisma'],core_env)
  pattern='account-email-handoff.*\\.test'
  if args.include_core_account_foundations:
   pattern='services/(account-email-handoff.*|account|staff-account)\\.test|http/(staff-api|password-reset-api|password-reset-failure-enumeration)\\.test'
  p=subprocess.run(['npx','--no-install','jest','--config','jest.core-v2.config.js','--runInBand','--testPathPatterns='+pattern],env=core_env,capture_output=True,text=True)
  combined=p.stdout+'\n'+p.stderr
  safe=[]
  for line in combined.splitlines():
   if line.startswith(('Test Suites:', 'Tests:', 'Snapshots:', 'Time:')): safe.append(line)
   elif re.fullmatch(r'FAIL __tests__/[A-Za-z0-9_./-]+(?: \(.*\))?',line): safe.append(line.split(' (',1)[0])
  safe.append('OUTPUT_SHA256='+hashlib.sha256(combined.encode()).hexdigest())
  (out/'core-account-handoff-summary.log').write_text('\n'.join(safe)+'\n')
  for line in safe: print(line)
  print('CORE_ACCOUNT_HANDOFF_TEST_EXIT='+str(p.returncode))
  if p.returncode: raise RuntimeError('CORE_ACCOUNT_HANDOFF_TEST_FAILED')
 if source_identity()!=source_before: raise RuntimeError('REHEARSAL_SOURCE_CHANGED_DURING_TESTS')
 print('REHEARSAL_SOURCE_IDENTITY_STABLE=1')
finally:
 info=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
 assert info['Config']['Labels']['nexus.recovery.owner']=='stage-lead-decision-rehearsal'
 assert '/var/lib/postgresql/data' in info['HostConfig']['Tmpfs']
 subprocess.run(['docker','stop',name],capture_output=True,check=True)
 print('OWNED_TMPFS_INSTANCE_STOPPED')
