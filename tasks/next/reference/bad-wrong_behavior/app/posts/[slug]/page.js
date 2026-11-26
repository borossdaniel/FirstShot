export default async function PostPage({ params }) {
  const { slug } = await params;
  return <h1>Post: {slug}</h1>;
}
