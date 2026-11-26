export async function listOpenTasks(supabase, projectId, limit = 20) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, created_at')
    .eq('project_id', projectId)
    .eq('done', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function addTask(supabase, projectId, title) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ project_id: projectId, title, done: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}
