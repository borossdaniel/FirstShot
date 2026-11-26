import { PutObjectCommand, GetObjectCommand, paginateListObjectsV2 } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function uploadJson(s3, bucket, key, data) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  }));
}

export async function listKeys(s3, bucket, prefix) {
  const keys = [];
  for await (const page of paginateListObjectsV2({ client: s3 }, { Bucket: bucket, Prefix: prefix })) {
    for (const obj of page.Contents ?? []) keys.push(obj.Key);
  }
  return keys;
}

export function getDownloadUrl(s3, bucket, key) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 15 * 60 });
}
