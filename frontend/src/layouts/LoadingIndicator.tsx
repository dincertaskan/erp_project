import { useIsFetching } from '@tanstack/react-query';
import { useNavigation } from 'react-router-dom';
import { TopProgress } from '@/components/TopProgress';

/**
 * Üstte ince yükleme çubuğu: sayfa parçası indirilirken (rota geçişi) ya da henüz verisi olmayan bir sorgu
 * yüklenirken görünür; arka plan yenilemelerinde görünmez.
 */
export function LoadingIndicator() {
  const navigation = useNavigation();
  const loading = useIsFetching({ predicate: (query) => query.state.status === 'pending' });
  return navigation.state === 'loading' || loading > 0 ? <TopProgress /> : null;
}
