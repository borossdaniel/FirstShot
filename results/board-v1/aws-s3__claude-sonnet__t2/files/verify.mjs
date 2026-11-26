import assert from "node:assert/strict";
import { S3Client } from "@aws-sdk/client-s3";
import { uploadJson, listKeys, getDownloadUrl } from "./solution.mjs";

// --- uploadJson: check PutObjectCommand is sent with correct shape ---
{
  let captured;
  const fakeS3 = {
    async send(cmd) {
      captured = cmd;
      return {};
    },
  };
  await uploadJson(fakeS3, "my-bucket", "path/data.json", { hello: "world" });
  assert.equal(captured.constructor.name, "PutObjectCommand");
  assert.equal(captured.input.Bucket, "my-bucket");
  assert.equal(captured.input.Key, "path/data.json");
  assert.equal(captured.input.ContentType, "application/json");
  assert.equal(captured.input.Body, JSON.stringify({ hello: "world" }));
  console.log("uploadJson: OK");
}

// --- listKeys: check pagination across multiple pages ---
{
  const pages = [
    { Contents: [{ Key: "a/1" }, { Key: "a/2" }], IsTruncated: true, NextContinuationToken: "tok1" },
    { Contents: [{ Key: "a/3" }], IsTruncated: true, NextContinuationToken: "tok2" },
    { Contents: [{ Key: "a/4" }], IsTruncated: false },
  ];
  let callCount = 0;
  const fakeS3 = {
    async send(cmd) {
      assert.equal(cmd.constructor.name, "ListObjectsV2Command");
      assert.equal(cmd.input.Bucket, "my-bucket");
      assert.equal(cmd.input.Prefix, "a/");
      if (callCount === 1) assert.equal(cmd.input.ContinuationToken, "tok1");
      if (callCount === 2) assert.equal(cmd.input.ContinuationToken, "tok2");
      const page = pages[callCount];
      callCount++;
      return page;
    },
  };
  const keys = await listKeys(fakeS3, "my-bucket", "a/");
  assert.deepEqual(keys, ["a/1", "a/2", "a/3", "a/4"]);
  assert.equal(callCount, 3);
  console.log("listKeys: OK (pagination across 3 pages)");
}

// --- listKeys: empty result ---
{
  const fakeS3 = {
    async send() {
      return { Contents: [], IsTruncated: false };
    },
  };
  const keys = await listKeys(fakeS3, "my-bucket", "nope/");
  assert.deepEqual(keys, []);
  console.log("listKeys: OK (empty)");
}

// --- getDownloadUrl: check it builds a GetObjectCommand and uses 900s expiry ---
// Uses a real S3Client instance (as the "already-configured client" the
// functions expect) with dummy static credentials, so no network call or
// real AWS account is needed to test the presigning logic itself.
{
  const realS3 = new S3Client({
    region: "us-east-1",
    credentials: {
      accessKeyId: "AKIAFAKEFAKEFAKEFAKE",
      secretAccessKey: "fakefakefakefakefakefakefakefakefakefake",
    },
  });

  const url = await getDownloadUrl(realS3, "my-bucket", "path/data.json");
  assert.equal(typeof url, "string");
  assert.match(url, /^https?:\/\//);
  assert.match(url, /X-Amz-Expires=900\b/);
  assert.match(url, /my-bucket/);
  assert.match(url, /data\.json/);
  console.log("getDownloadUrl: OK ->", url);
}

console.log("\nAll checks passed.");
