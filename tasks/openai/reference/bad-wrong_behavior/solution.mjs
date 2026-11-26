export async function ask(client, question) {
  const r = await client.chat.completions.create({ model: 'gpt-5.2', messages: [{ role: 'user', content: question }] });
  return r.choices[0].message.content;
}
export async function classify(client, text) {
  return { label: 'spam' };
}
