import { useSuspenseQuery } from '@tanstack/react-query';
import { useTRPC } from '../../../utils/trpc';
import type { ParsedSearchQuery } from '../../../utils/searchParser';
import { useListState } from '../list/ListContext';

export function useFilteredArticles(parsedFilters: ParsedSearchQuery) {
  const listState = useListState();
  const sortBy = listState ? listState.sortBy : 'newest';
  const trpc = useTRPC();
  const { data: filteredArticles } = useSuspenseQuery(
    trpc.searchArticles.queryOptions({
      q: parsedFilters.q,
      category: parsedFilters.category,
      sort: sortBy,
      before: parsedFilters.before,
      after: parsedFilters.after,
      topic: parsedFilters.topic,
      includeFullText: true,
    })
  );
  return filteredArticles;
}
