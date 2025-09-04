export class Client {
  constructor(_cfg: any) {}
  async bucketExists(_b: string) { return false; }
  async makeBucket(_b: string) { return; }
  async fPutObject(_b: string, _k: string, _p: string) { return; }
}
