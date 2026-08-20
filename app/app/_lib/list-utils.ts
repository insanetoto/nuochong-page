export function filterByQuery<T>(
  items: T[],
  query: string,
  getFields: (item: T) => string[],
): T[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return items;

  return items.filter((item) =>
    getFields(item).some((field) => field.toLowerCase().includes(keyword)),
  );
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
