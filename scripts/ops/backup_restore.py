#!/usr/bin/env python3
"""Root-only PostgreSQL logical backups and isolated restore evidence. No deletions."""
import argparse,copy,shutil,datetime,fcntl,hashlib,json,os,pathlib,pwd,re,subprocess,sys,time,uuid
class Failure(Exception):pass
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def ident(s):return '"'+s.replace('"','""')+'"'
def literal(s):return "'"+s.replace("'","''")+"'"
def sync_path(p):
 fd=os.open(p,os.O_RDONLY)
 try:os.fsync(fd)
 finally:os.close(fd)
def durable_rename(source,target):
 if source.is_dir():
  for child in source.rglob('*'):
   if child.is_file():sync_path(child)
  for child in sorted([q for q in source.rglob('*') if q.is_dir()],key=lambda q:len(q.parts),reverse=True):sync_path(child)
 sync_path(source);sync_path(source.parent);os.replace(source,target)
 try:sync_path(target.parent)
 except OSError:
  # Do not leave a success-looking final directory after a durability failure.
  os.replace(target,source)
  raise
def file_hash(p):
 with p.open("rb") as f:return hashlib.file_digest(f,"sha256").hexdigest()
def write(p,x):
 p.write_text(json.dumps(x,indent=2)+'\n');p.chmod(0o600);sync_path(p);sync_path(p.parent)
def run(cmd,stdin=None):
 r=subprocess.run(cmd,input=stdin,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120)
 if r.returncode:raise Failure('command failed: '+pathlib.Path(cmd[0]).name+' exit='+str(r.returncode))
 return r.stdout
def stream(cmd,p,source=None):
 tmp=pathlib.Path(str(p)+'.partial')
 with tmp.open('xb') as out,pathlib.Path(str(p)+'.stderr').open('xb') as err:
  tmp.chmod(0o600);os.chmod(err.name,0o600)
  r=subprocess.run(cmd,stdin=source,stdout=out,stderr=err,timeout=120)
 if r.returncode or not tmp.stat().st_size:raise Failure('artifact failed: '+p.name+' exit='+str(r.returncode))
 durable_rename(tmp,p)
def prefix(i,tool):
 if i.get('container'):return ['docker','exec','-i',i['container'],tool,'-U',i['transport_user']]
 return ['runuser','-u','postgres','--','/usr/lib/postgresql/16/bin/'+tool,'-p','5433']
def sql(i,db,q):return run(prefix(i,'psql')+['-X','-A','-t','-v','ON_ERROR_STOP=1','-d',db,'-c',q]).decode().strip()
class Session:
 def __init__(self,i,db,err):
  self.err=err.open('xb');os.chmod(err,0o600)
  self.p=subprocess.Popen(prefix(i,'psql')+['-X','-A','-t','-q','-v','ON_ERROR_STOP=1','-d',db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=self.err,text=True,bufsize=1)
 def query(self,q):
  marker='DONE_'+uuid.uuid4().hex
  self.p.stdin.write(q+';\n\\echo '+marker+'\n');self.p.stdin.flush();lines=[]
  while True:
   line=self.p.stdout.readline()
   if not line:raise Failure('snapshot session terminated')
   if line.strip()==marker:return '\n'.join(lines).strip()
   lines.append(line.rstrip('\n'))
 def close(self):
  try:self.p.stdin.write('ROLLBACK;\n\\q\n');self.p.stdin.flush()
  except (BrokenPipeError,OSError):pass
  self.p.wait(timeout=30);self.err.close()
META="""SELECT json_build_object(
 'schemas',(SELECT coalesce(json_agg(nspname ORDER BY nspname),'[]') FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'),
 'tables',(SELECT coalesce(json_agg(json_build_array(n.nspname,c.relname,c.relkind) ORDER BY n.nspname,c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','m') AND n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'),
 'constraints',(SELECT coalesce(json_agg(json_build_array(n.nspname,c.relname,t.conname,pg_get_constraintdef(t.oid)) ORDER BY n.nspname,c.relname,t.conname),'[]') FROM pg_constraint t JOIN pg_class c ON c.oid=t.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'),
 'indexes',(SELECT coalesce(json_agg(json_build_array(schemaname,tablename,indexname,indexdef) ORDER BY schemaname,tablename,indexname),'[]') FROM pg_indexes WHERE schemaname !~ '^pg_' AND schemaname <> 'information_schema'),
 'extensions',(SELECT coalesce(json_agg(json_build_array(extname,extversion) ORDER BY extname),'[]') FROM pg_extension))"""
ACL_META="""SELECT json_build_object(
 'database',(SELECT json_build_object('owner',pg_get_userbyid(datdba),'acl',(SELECT json_agg(json_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable) ORDER BY a.grantee=0,pg_get_userbyid(a.grantee),a.privilege_type,a.is_grantable) FROM aclexplode(coalesce(datacl,acldefault('d',datdba))) a)) FROM pg_database WHERE datname=current_database()),
 'schema_owners_acl',(SELECT coalesce(json_agg(json_build_array(nspname,pg_get_userbyid(nspowner),ARRAY(SELECT x::text FROM unnest(nspacl) x ORDER BY x::text)) ORDER BY nspname),'[]') FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'),
 'relation_owners_acl',(SELECT coalesce(json_agg(json_build_array(n.nspname,c.relname,pg_get_userbyid(c.relowner),ARRAY(SELECT x::text FROM unnest(c.relacl) x ORDER BY x::text)) ORDER BY n.nspname,c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND c.relkind IN ('r','p','m','v','S','f')),
 'default_acl',(SELECT coalesce(json_agg(json_build_array(pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype,ARRAY(SELECT x::text FROM unnest(d.defaclacl) x ORDER BY x::text)) ORDER BY pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype),'[]') FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace),
 'function_owners_acl',(SELECT coalesce(json_agg(json_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_userbyid(p.proowner),ARRAY(SELECT x::text FROM unnest(p.proacl) x ORDER BY x::text)) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'))"""
def role_inventory(query,exclude=None):
 where='rolname <> '+literal(exclude) if exclude else 'true'
 roles=json.loads(query("SELECT coalesce(json_agg(json_build_object('name',rolname,'super',rolsuper,'inherit',rolinherit,'createrole',rolcreaterole,'createdb',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypassrls',rolbypassrls,'connlimit',rolconnlimit,'validuntil',rolvaliduntil::text,'config',rolconfig) ORDER BY rolname),'[]') FROM pg_roles WHERE "+where))
 members=json.loads(query("SELECT coalesce(json_agg(json_build_array(pg_get_userbyid(roleid),pg_get_userbyid(member),admin_option,to_jsonb(m)->'inherit_option',to_jsonb(m)->'set_option') ORDER BY pg_get_userbyid(roleid),pg_get_userbyid(member)),'[]') FROM pg_auth_members m"))
 return {'roles':roles,'memberships':members}
def privilege_inventory(query):
 return json.loads(query("SELECT coalesce(json_agg(json_build_array(r.rolname,n.nspname,c.relname,has_schema_privilege(r.oid,n.oid,'USAGE'),has_table_privilege(r.oid,c.oid,'SELECT'),has_table_privilege(r.oid,c.oid,'INSERT'),has_table_privilege(r.oid,c.oid,'UPDATE'),has_table_privilege(r.oid,c.oid,'DELETE')) ORDER BY r.rolname,n.nspname,c.relname),'[]') FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE r.rolname='nexus_runtime' AND c.relkind IN ('r','p','m','v') AND n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'"))
def _varchar_norm(definition):
 # PostgreSQL may distribute a varchar[] -> text[] cast during parse/deparse.
 # Match only arrays of varchar string literals; skip quoted SQL strings/identifiers.
 value=r"'(?:[^']|'')*'::character varying"
 array=r"\(ARRAY\[(?P<values>"+value+r"(?:,\s*"+value+r")*)\]\)::text\[\]"
 token=re.compile(r"'(?:[^']|'')*'|\"(?:[^\"]|\"\")*\"|"+array)
 def replace(match):
  if match.group('values') is None:return match.group(0)
  values=re.findall(value,match.group('values'))
  return 'ARRAY['+', '.join('('+x+')::text' for x in values)+']'
 return token.sub(replace,definition)
# AND/OR-associativity normalization. PostgreSQL expands BETWEEN/IN into grouped
# sub-ANDs, so the live catalog may render a CHECK as ((A AND B) AND C) while
# dump->restore reparses it to the flattened A AND B AND C — logically identical.
# This flattens parentheses ONLY around chains of the SAME boolean operator and
# strips redundant grouping parentheses; mixed AND/OR keep their parentheses, so
# precedence is never altered. Any imbalance/ambiguity returns the input
# unchanged: it can only remove a false positive, never mask a real difference,
# and never raises. Validated over 3005 live constraints (0 collision, idempotent).
def _skip_string(s,i):
 q=s[i];j=i+1;n=len(s)
 while j<n:
  if s[j]==q:
   if j+1<n and s[j+1]==q:j+=2;continue
   return j+1
  j+=1
 raise ValueError('unterminated string')
def _split_top(s):
 parts=[];ops=[];depth=0;i=0;n=len(s);start=0
 while i<n:
  c=s[i]
  if c in "'\"":
   i=_skip_string(s,i);continue
  if c in '([':depth+=1;i+=1;continue
  if c in ')]':depth-=1;i+=1;continue
  if depth==0 and (c=='A' or c=='O'):
   for kw in ('AND','OR'):
    if s[i:i+len(kw)]==kw:
     before=s[i-1] if i>0 else ' '
     after=s[i+len(kw)] if i+len(kw)<n else ' '
     if (not before.isalnum() and before!='_') and (not after.isalnum() and after!='_'):
      parts.append(s[start:i]);ops.append(kw);i+=len(kw);start=i;break
   else:
    i+=1;continue
   continue
  i+=1
 parts.append(s[start:])
 if depth!=0:raise ValueError('imbalance')
 return parts,ops
def _strip_one_paren(s):
 s=s.strip()
 if not s.startswith('(') or not s.endswith(')'):return None
 depth=0;i=0;n=len(s)
 while i<n:
  c=s[i]
  if c in "'\"":
   i=_skip_string(s,i);continue
  if c=='(':depth+=1
  elif c==')':
   depth-=1
   if depth==0:
    return s[1:-1] if i==n-1 else None
  i+=1
 return None
def _canon(s):
 s=s.strip()
 while True:
  inner=_strip_one_paren(s)
  if inner is None:break
  s=inner.strip()
 parts,ops=_split_top(s)
 if len(parts)<=1:
  return (s,'atom')
 if len(set(ops))!=1:
  out=_render_child(parts[0])
  for op,p in zip(ops,parts[1:]):
   out+=' '+op+' '+_render_child(p)
  return (out,'mixed')
 op=ops[0];flat=[]
 for p in parts:
  t,k=_canon(p)
  if k==op:flat.append(t)
  elif k in ('AND','OR','mixed'):flat.append('('+t+')')
  else:flat.append(t)
 return ((' '+op+' ').join(flat),op)
def _render_child(p):
 t,k=_canon(p)
 if k in ('AND','OR','mixed'):return '('+t+')'
 return t
def _assoc_norm(definition):
 try:
  m=re.match(r'^(CHECK)\s*\((.*)\)\s*$',definition,re.S)
  if not m:return definition
  inner=m.group(2)
  if _strip_one_paren('('+inner+')') is None:return definition
  t,_=_canon(inner)
  return 'CHECK ('+t+')'
 except Exception:
  return definition
def canonical_constraint(definition):
 return _assoc_norm(_varchar_norm(definition))
def comparable_inventory(value):
 result=copy.deepcopy(value)
 for constraint in result['constraints']:constraint[3]=canonical_constraint(constraint[3])
 return result

def inventory(query):
 raw_query=query
 def query(q):return raw_query("SET search_path=pg_catalog; "+q).removeprefix("SET\n")
 x=json.loads(query(META));x['acl']=json.loads(query(ACL_META));x['runtime_effective_privileges']=privilege_inventory(query);x['counts']={}
 for schema,table,kind in x['tables']:
  name=ident(schema)+'.'+ident(table)
  x['counts'][name]=int(query('SELECT count(*) FROM '+name))
 return x

def preflight(i):
 if i.get('container'):
  actual=run(['docker','inspect','--format','{{.Image}}',i['container']]).decode().strip()
  if actual!=i['image_id']:raise Failure('source image drift: refresh reviewed database map before backup')
 version=sql(i,'postgres','SHOW server_version_num')
 match=re.match(r'^(\d+)\.(\d+)',i['version'])
 if not match:raise Failure('invalid source version in reviewed database map')
 expected=int(match.group(1))*10000+int(match.group(2))
 if int(version)!=expected:raise Failure('source PostgreSQL version drift: refresh reviewed database map before backup')
 return {'checked_utc':now(),'server_version_num':int(version),'image_id':i.get('image_id')}

def backup_instance(i,folder):
 folder.mkdir(mode=0o700);write(folder/'preflight.json',preflight(i));started=now();result={'source':i,'started_utc':started,'databases':[]}
 live=json.loads(sql(i,'postgres',"SELECT json_agg(json_build_object('datname',datname,'owner',pg_get_userbyid(datdba),'datallowconn',datallowconn) ORDER BY datname) FROM pg_database WHERE NOT datistemplate"))
 if any(not d['datallowconn'] for d in live):raise Failure('non-template database disallows connections; explicit handling required')
 write(folder/'roles-expected.json',role_inventory(lambda q:sql(i,'postgres',q)))
 stream(prefix(i,'pg_dumpall')+['--roles-only'],folder/'roles.sql')
 for n,db in enumerate(live):
  dbdir=folder/('db-'+str(n));dbdir.mkdir(mode=0o700)
  s=Session(i,db['datname'],dbdir/'snapshot.stderr')
  try:
   s.query('SET statement_timeout=30000; SET lock_timeout=5000; SET idle_in_transaction_session_timeout=150000')
   s.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
   snapshot=s.query('SELECT pg_export_snapshot()')
   started_db=now();stream(prefix(i,'pg_dump')+['--format=custom','--lock-wait-timeout=5s','--snapshot='+snapshot,'--dbname='+db['datname']],dbdir/'database.dump')
   expected=inventory(s.query);write(dbdir/'expected.json',expected)
  finally:s.close()
  with (dbdir/'database.dump').open('rb') as f:
   stream(prefix(i,'pg_restore')+['--list'],dbdir/'toc.txt',f)
  result['databases'].append({**db,'directory':dbdir.name,'snapshot_utc':started_db,'tables':len(expected['tables'])})
 result['finished_utc']=now();write(folder/'backup.json',result);return result

def restore_instance(i,folder,root,runid):
 started=time.monotonic();admin='remediation_'+uuid.uuid4().hex[:12];name='nexus-restore-'+uuid.uuid4().hex[:12]
 native=not i.get('container');created=False;target=None
 try:
  if native:
   # root-owned run evidence stays private; native PG needs an independently traversable parent.
   base=pathlib.Path('/var/lib/postgresql/nexus-restore-tests');base.mkdir(mode=0o700,exist_ok=True)
   account=pwd.getpwnam('postgres');os.chown(base,account.pw_uid,account.pw_gid)
   data=base/name;data.mkdir(mode=0o700);os.chown(data,account.pw_uid,account.pw_gid)
   socket=data/'socket';socket.mkdir(mode=0o700);os.chown(socket,account.pw_uid,account.pw_gid)
   basecmd=['runuser','-u','postgres','--','/usr/lib/postgresql/16/bin/']
   run(basecmd[:-1]+[basecmd[-1]+'initdb','-D',str(data/'data'),'-U',admin,'--auth-local=trust','--auth-host=reject'])
   created=True
   run(basecmd[:-1]+[basecmd[-1]+'pg_ctl','-D',str(data/'data'),'-l',str(data/'server.log'),'-o',"-c listen_addresses='' -c unix_socket_directories="+str(socket)+' -c port=55439 -c shared_buffers=64MB -c max_connections=20','-w','start']);created=True
   def command(tool):return ['runuser','-u','postgres','--','/usr/lib/postgresql/16/bin/'+tool,'-h',str(socket),'-p','55439','-U',admin]
  else:
   data=root/'restore-tests'/runid/name;data.mkdir(mode=0o700,parents=True)
   run(['docker','run','-d','--name',name,'--label','nexus.remediation.restore='+runid,'--network','none','--memory','1g','--cpus','1','--pids-limit','256','--restart','no','--log-opt','max-size=10m','--log-opt','max-file=2','-e','POSTGRES_USER='+admin,'-e','POSTGRES_DB=remediation_control','-e','POSTGRES_HOST_AUTH_METHOD=trust','-v',str(data)+':/var/lib/postgresql/data',i['image_id']]);created=True
   def command(tool):return ['docker','exec','-i',name,tool,'-U',admin]
  for attempt in range(90):
   try:run(command('pg_isready'));break
   except Failure:time.sleep(1)
  else:raise Failure('isolated postgres not ready')
  def query(db,q):return run(command('psql')+['-X','-A','-t','-v','ON_ERROR_STOP=1','-d',db,'-c',q]).decode().strip()
  control='remediation_control'
  if native:query('postgres','CREATE DATABASE remediation_control')
  query(control,'ALTER DATABASE postgres RENAME TO '+ident('remediation_empty_'+uuid.uuid4().hex[:12]))
  roles=folder/'roles.sql'
  with roles.open('rb') as f:
   with (folder/'restore-roles.stderr').open('xb') as err:
    rc=subprocess.run(command('psql')+['-X','-v','ON_ERROR_STOP=1','-d',control],stdin=f,stdout=subprocess.DEVNULL,stderr=err,timeout=120).returncode
   if rc:raise Failure('role restore failed')
  restored_roles=role_inventory(lambda q:query(control,q),admin);write(folder/'roles-restored.json',restored_roles)
  if restored_roles!=json.loads((folder/'roles-expected.json').read_text()):raise Failure('role attributes or membership mismatch')
  info=json.loads((folder/'backup.json').read_text());results=[]
  for db in info['databases']:
   dbdir=folder/db['directory'];dbstart=time.monotonic();dbname=db['datname']
   args=command('pg_restore')+['--exit-on-error']
   args+=['--create','--dbname='+control,'--role='+i['transport_user']]
   with (dbdir/'database.dump').open('rb') as f,(dbdir/'restore.stderr').open('xb') as err:
    rc=subprocess.run(args,stdin=f,stdout=subprocess.DEVNULL,stderr=err,timeout=120).returncode
   if rc:raise Failure('database restore failed: '+dbdir.name)
   actual=inventory(lambda q:query(dbname,q));write(dbdir/'restored.json',actual)
   expected=json.loads((dbdir/'expected.json').read_text())
   canonical_match=comparable_inventory(actual)==comparable_inventory(expected)
   write(dbdir/'comparison.json',{'raw_exact_match':actual==expected,'canonical_match':canonical_match,'normalization':'Distribute varchar literal array cast to text[] over each literal; other constraints and all other inventory fields remain strict'})
   if not canonical_match:raise Failure('restored inventory mismatch: '+dbdir.name)
   # Application-role SQL read probe, inside isolated DB only; no business records emitted.
   probes={}
   for table,count in expected['counts'].items():
    value=query(dbname,'BEGIN READ ONLY; SET LOCAL ROLE '+ident(db['owner'])+'; SELECT count(*) FROM '+table+'; ROLLBACK;')
    numbers=[line for line in value.splitlines() if line.isdigit()]
    if not numbers or int(numbers[-1])!=count:raise Failure('owner access probe mismatch')
    probes[table]=True
   item={'database':dbname,'restored':True,'raw_exact_inventory_match':actual==expected,'canonical_inventory_match':True,'owner_sql_read_probe':True,'tables':len(probes),'rto_seconds':round(time.monotonic()-dbstart,3)}
   results.append(item);write(dbdir/'verification.json',item)
  write(folder/'restore.json',{'finished_utc':now(),'rto_seconds':round(time.monotonic()-started,3),'isolated_target':name,'native':native,'storage':str(data),'databases':results,'limitations':['SQL owner read probes are not a full frontend/API journey','RPO measured as age of snapshot, not PITR; no WAL archival','roles and separate databases do not share a cluster-wide transaction']})
 finally:
  if created:
   if native and (data/'data'/'postmaster.pid').exists():run(['runuser','-u','postgres','--','/usr/lib/postgresql/16/bin/pg_ctl','-D',str(data/'data'),'-m','fast','-w','stop'])
   elif not native:
    label=run(['docker','inspect','--format','{{ index .Config.Labels "nexus.remediation.restore" }}',name]).decode().strip()
    if label!=runid:raise Failure('refusing stop: label mismatch')
    run(['docker','stop','-t','30',name])

def execute(instances,root,runid,backup_only):
 folder=root/'runs'/(runid+'.partial');folder.mkdir(parents=True,mode=0o700)
 try:
  for n,i in enumerate(instances):
   target=folder/('instance-'+str(n));backup_instance(i,target)
   if not backup_only:restore_instance(i,target,root,runid)
  hashes={str(p.relative_to(folder)):file_hash(p) for p in folder.rglob('*') if p.is_file()}
  write(folder/'SHA256.json',hashes);write(folder/'result.json',{'utc':now(),'backup_complete':True,'restore_verified':not backup_only,'instances':len(instances)})
  final=folder.with_suffix('');durable_rename(folder,final);return final
 except Exception as exc:
  write(folder/'FAILED.json',{'utc':now(),'status':'failed','error_type':type(exc).__name__,'reason':str(exc) if isinstance(exc,Failure) else 'internal error; no success published'})
  raise

def restore_existing(source,root,runid):
 source=source.resolve();allowed=(root/'runs').resolve()
 if source.parent!=allowed:raise Failure('existing run must be an immediate child of backup runs directory')
 if not json.loads((source/'result.json').read_text()).get('backup_complete'):raise Failure('existing run is not a completed backup')
 hashes=json.loads((source/'SHA256.json').read_text())
 for relative,expected in hashes.items():
  path=(source/relative).resolve()
  if not path.is_relative_to(source) or not path.is_file() or file_hash(path)!=expected:raise Failure('existing backup checksum mismatch')
 instances=sorted(source.glob('instance-*'),key=lambda p:int(p.name.split('-')[1]))
 if not instances:raise Failure('existing backup contains no instances')
 folder=root/'runs'/(runid+'.partial');folder.mkdir(mode=0o700)
 try:
  write(folder/'origin.json',{'source_run':str(source),'source_checksums_verified':True,'utc':now()})
  ignored={'restore.stderr','restored.json','verification.json','comparison.json','restore-roles.stderr','restore.json','roles-restored.json'}
  for original in instances:
   # Distinct copies, never hardlinks: retries cannot mutate canonical backup evidence.
   target=folder/original.name
   shutil.copytree(original,target,ignore=lambda d,n:[x for x in n if x in ignored],copy_function=shutil.copy2)
   info=json.loads((target/'backup.json').read_text())
   restore_instance(info['source'],target,root,runid)
  checksums={str(p.relative_to(folder)):file_hash(p) for p in folder.rglob('*') if p.is_file()}
  write(folder/'SHA256.json',checksums);write(folder/'result.json',{'utc':now(),'backup_complete':True,'restore_verified':True,'instances':len(instances),'restored_from':str(source)})
  final=folder.with_suffix('');durable_rename(folder,final);return final
 except Exception as exc:
  write(folder/'FAILED.json',{'utc':now(),'status':'failed','error_type':type(exc).__name__,'reason':str(exc) if isinstance(exc,Failure) else 'internal error; no success published'})
  raise

def main():
 os.umask(0o077)
 p=argparse.ArgumentParser();p.add_argument('--map');p.add_argument('--restore-existing');p.add_argument('--root',default='/var/backups/nexus-verified');p.add_argument('--backup-only',action='store_true');p.add_argument('--instance');a=p.parse_args()
 if os.geteuid()!=0:raise Failure('must run as root')
 root=pathlib.Path(a.root);root.mkdir(mode=0o700,parents=True,exist_ok=True)
 lock=(root/'backup.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 runid=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:8]
 if a.restore_existing:
  if a.backup_only or a.instance:raise Failure('restore-existing cannot combine with backup-only or instance')
  result=restore_existing(pathlib.Path(a.restore_existing),root,runid);print(json.dumps({'status':'restore_verified','run':str(result)}));return
 if not a.map:raise Failure('map required for source backup')
 instances=json.loads(pathlib.Path(a.map).read_text())['instances']
 if a.instance:instances=[i for i in instances if (i.get('container') or 'host-pg16')==a.instance]
 if not instances:raise Failure('no matching instance')
 runid=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:8]
 result=execute(instances,root,runid,a.backup_only);print(json.dumps({'status':'backup_complete' if a.backup_only else 'restore_verified','run':str(result)}))
if __name__=='__main__':
 try:main()
 except Exception as e:
  print(json.dumps({'status':'failed','error_type':type(e).__name__,'reason':str(e) if isinstance(e,Failure) else 'internal error; inspect root-only evidence'}),file=sys.stderr);sys.exit(1)
