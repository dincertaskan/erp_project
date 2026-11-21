import { PageContainer } from '@ant-design/pro-components';
import { Card, Typography } from 'antd';

/** Henüz geliştirilmemiş ekranlar için geçici sayfa */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <PageContainer title={title}>
      <Card>
        <Typography.Text type="secondary">Bu ekran geliştirme aşamasında.</Typography.Text>
      </Card>
    </PageContainer>
  );
}
