// Deterministic mock for the MinIO helper used in integration tests
// Matches the signature used by MinioStorage.put: putObjectFromFile(localPath, destKey)

module.exports = {
  async putObjectFromFile(localPath, destKey) {
    const endpoint = process.env.MINIO_PUBLIC_ENDPOINT || 'http://minio.local';
    const bucket = process.env.MINIO_BUCKET || 'nexus-docs-test';
    // Return a URL string consistent with the real helper shape used in tests
    return `${endpoint}/${bucket}/${destKey}`;
  },
};

