export default async function PostPage({ params }) {
  const { slug } = await params;
  return (
    <main>
      <h1>Post: {slug}</h1>
    </main>
  );
}
