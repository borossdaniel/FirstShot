import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function uploadJson(s3, bucket, key, data) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: JSON.stringify(data), ContentType: 'application/json' }));
}

// Only reads the first page: S3 returns at most 1,000 keys per request.
export async function listKeys(s3, bucket, prefix) {
  const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  return (res.Contents ?? []).map((o) => o.Key);
}

export async function getDownloadUrl(s3, bucket, key) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 900 });
}
