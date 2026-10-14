/** Offline verification only; no install, package execution or network access.
 * Signature format: https://docs.npmjs.com/about-registry-signatures/ */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,createPublicKey,verify} from 'node:crypto';
const hash=(bytes,algorithm='sha256',encoding='hex')=>createHash(algorithm).update(bytes).digest(encoding);
const requireCondition=(condition,message)=>{if(!condition)throw new Error(message);};
export const NPM_INPUT_PINS=[
  {name:'npm',version:'11.21.0',sha256:'783e7c92bf73b442fb800c2d6ef3921e86da8894a700fed45140e37916877482',
    integrity:'sha512-Zov8KhamNneiLdELtj5YALtNmJW4L4fCLTzjfpzXG2w6MSHcf0UxgdlK5uloCuksWT+7mGUU7wi79cO6RqivPg=='},
  {name:'brace-expansion',version:'5.0.12',sha256:'ef8448ec78f20b692f04fa6d01f39b5ab34c66404bea3429f5a39c6c9e0be8b4',
    integrity:'sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ=='},
  {name:'http-cache-semantics',version:'4.3.0',sha256:'d75e1e6a11587954da5e2f0e2b5c4b397a16d28cc2f7bdf64e9027fc2fe593ee',
    integrity:'sha512-M5t5LlJpS1UHMjvwRQVdFHvPISGeLAxNcrWuJkeGh0KxsqCHZ1O3NXZU/8x7cD0BDcGW8kapxMKTvwlqrNkHkA=='},
  {name:'undici',version:'6.29.0',sha256:'b7d888586625c1508c0e17463bac86aecd22ed6053bc945372aed8cae14406fc',
    integrity:'sha512-R+RODBqp6i2pPflGdq+xIOUkl+RNfGgHwoinecKu/JCuf2uO06cOKoDbI2P7Dn6KcswdKwrczbU6IYJ6K8X+wg=='},
  {name:'ip-address',version:'10.7.1',sha256:'7f99ac7abda701afe1fd1e36de462236fb4d1eb8c595d7ae0267bba7d8ee55f8',
    integrity:'sha512-4OUAqU9Z1i3vCnS05hzGiFnEMDpQ+62pAD/MVQOp83fYyNC8GleCqaS0QikQBmcWCrKFiUs/B8ztRRiYOAXuCA=='},
  {name:'postcss-selector-parser',version:'7.1.6',sha256:'48c903f98c5591d8d26f16f389d5cb3435459474c645209a79f6241bf4b657b6',
    integrity:'sha512-7qASPzhKF2l2KLboRZux8CCTRMdGiV08vWmyKzPz22qZ7ZjQBOeY7rNzNoCLSUiftJ7HUq0GERHmxw/t0dCdMw=='},
];
const KEY_ID='SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U';
const KEY_DER_SHA256='fb190a462123443500cbcdb6519623e7179e9f38d84ad4e9362b72d2b68b62c1';
export function verifyArchive(archive,metadata,pin,key,keyId){
  const file=`${pin.name}-${pin.version}.tgz`;
  requireCondition(metadata.name===pin.name&&metadata.version===pin.version
    &&metadata.dist?.tarball===`https://registry.npmjs.org/${pin.name}/-/${file}`
    &&metadata.dist?.integrity===pin.integrity,'METADATA_MISMATCH');
  requireCondition(hash(archive)===pin.sha256,'SHA256_MISMATCH');
  requireCondition('sha512-'+hash(archive,'sha512','base64')===pin.integrity,'SRI_MISMATCH');
  requireCondition(Array.isArray(metadata.dist.signatures)&&metadata.dist.signatures.length>0,'SIGNATURE_INVALID');
  const message=Buffer.from(`${pin.name}@${pin.version}:${pin.integrity}`);
  for(const signature of metadata.dist.signatures)requireCondition(signature.keyid===keyId
    &&verify('sha256',message,key,Buffer.from(signature.sig,'base64')),'SIGNATURE_INVALID');
  return {name:pin.name,version:pin.version,file,sha256:pin.sha256,integrity:pin.integrity,bytes:archive.length,
    signaturesVerified:metadata.dist.signatures.length,gitHeadReported:metadata.gitHead??null,
    upstreamAttestationsPresent:!!metadata.dist.attestations,upstreamAttestationVerification:'not-performed'};
}
export function verifyNpmInputs(inputDir){
  const read=file=>readFileSync(path.join(inputDir,file));
  const keysBytes=read('registry-keys.json'),candidates=JSON.parse(keysBytes).keys.filter(key=>key.keyid===KEY_ID);
  requireCondition(candidates.length===1,'SIGNING_KEY_AMBIGUOUS');const key=candidates[0];
  requireCondition(key.expires===null&&key.keytype==='ecdsa-sha2-nistp256'&&key.scheme==='ecdsa-sha2-nistp256','SIGNING_KEY_METADATA_INVALID');
  const der=Buffer.from(key.key,'base64');requireCondition(hash(der)===KEY_DER_SHA256,'SIGNING_KEY_DER_MISMATCH');
  const publicKey=createPublicKey({key:der,format:'der',type:'spki'});
  const inputs=NPM_INPUT_PINS.map(pin=>{const stem=`${pin.name}-${pin.version}`,metadataBytes=read(`${stem}.metadata.json`);
    return {...verifyArchive(read(`${stem}.tgz`),JSON.parse(metadataBytes),pin,publicKey,KEY_ID),metadataSha256:hash(metadataBytes)};});
  return {schemaVersion:1,signingKeyId:KEY_ID,signingKeyDerSha256:KEY_DER_SHA256,registryKeysSha256:hash(keysBytes),
    verificationRuntime:{node:process.versions.node,openssl:process.versions.openssl,platform:process.platform,arch:process.arch,
      executableSha256:hash(readFileSync(process.execPath))},inputs};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  requireCondition(process.argv.length===3,'Usage: node scripts/release/verify-npm-inputs.mjs INPUT_DIR');
  process.stdout.write(JSON.stringify(verifyNpmInputs(process.argv[2]))+'\n');
}
