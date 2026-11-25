import { useIsFetching } from '@tanstack/react-query';
import { TopProgress } from '@/components/TopProgress';

/** Henüz verisi olmayan bir sorgu yüklenirken üstte ince çubuk gösterir; arka plan yenilemelerinde görünmez. */
export function LoadingIndicator() {
  const loading = useIsFetching({ predicate: (query) => query.state.status === 'pending' });
  return loading > 0 ? <TopProgress /> : null;
}
