// AWS SDK v2 (the `aws-sdk` package), which is in maintenance mode.
export async function uploadJson(s3, bucket, key, data) {
  await s3.putObject({ Bucket: bucket, Key: key, Body: JSON.stringify(data), ContentType: 'application/json' }).promise();
}

export async function listKeys(s3, bucket, prefix) {
  const keys = [];
  let token;
  do {
    const res = await s3.listObjectsV2({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }).promise();
    for (const o of res.Contents || []) keys.push(o.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

export function getDownloadUrl(s3, bucket, key) {
  return s3.getSignedUrl('getObject', { Bucket: bucket, Key: key, Expires: 900 });
}
