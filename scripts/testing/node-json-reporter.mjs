/** Preserve every nested test and the final native counts; omit diagnostic payloads. */
import {beginNativeProducer,sealNativeProducer} from './native-provenance.mjs';
export default async function* reporter(events) {
  const receipt=beginNativeProducer(import.meta.url);
  const tests=[];let summary=null;
  for await(const event of events){
    const data=event.data;
    if(event.type==='test:pass'||event.type==='test:fail'){
      tests.push({file:data.file,title:data.name,line:data.line??null,column:data.column??null,
        type:data.details?.type??'test',status:data.skip?'skipped':data.todo?'todo':event.type==='test:pass'?'passed':'failed'});
    }
    if(event.type==='test:summary'&&!data.file)summary={success:data.success,counts:data.counts};
  }
  const bytes=Buffer.from(JSON.stringify({schemaVersion:'node-test-native/v1',tests,summary})+'\n');
  sealNativeProducer(receipt,bytes);yield bytes.toString('utf8');
}
