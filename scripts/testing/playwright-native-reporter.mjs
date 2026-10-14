import {createRequire} from 'node:module';
import path from 'node:path';
import {beginNativeProducer,sealNativeProducer} from './native-provenance.mjs';
const require=createRequire(import.meta.url);
const packageRoot=path.dirname(require.resolve('playwright/package.json'));
const JSONReporter=require(path.join(packageRoot,'lib/reporters/json.js')).default;
export default class NativeProvenanceReporter extends JSONReporter {
  constructor(options={}){
    super({...options,outputFile:process.env.NEXUS_TEST_NATIVE_OUTPUT});
    this.receipt=beginNativeProducer(import.meta.url);
  }
  async onEnd(result){await super.onEnd(result);sealNativeProducer(this.receipt);}
}
