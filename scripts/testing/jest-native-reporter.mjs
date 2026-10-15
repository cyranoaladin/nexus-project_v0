import {beginNativeProducer,sealNativeProducer} from './native-provenance.mjs';
export default class NativeProvenanceReporter {
  constructor(){
    const receipt=beginNativeProducer(import.meta.url);
    // Jest calculates final success and writes its JSON after onRunComplete.
    process.once('exit',code=>{
      try{sealNativeProducer(receipt);}catch{console.error('NATIVE_PROVENANCE_SEAL_FAILED');if(code===0)process.exitCode=1;}
    });
  }
}
