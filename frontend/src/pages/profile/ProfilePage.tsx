import { PageContainer } from '@ant-design/pro-components';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, App, Avatar, Button, Card, Col, Descriptions, Form, Input, Row, Space, Typography } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import type { CurrentUser } from '@/api/types';
import { ME_QUERY_KEY } from '@/auth/context';
import { useAuth } from '@/auth/useAuth';
import { RoleTag } from '@/components/StatusTag';
import { colors } from '@/theme';
import { applyServerErrors } from '@/utils/forms';
import { formatDate, formatDateTime } from '@/utils/format';
import { usePageTitle } from '@/hooks/usePageTitle';

interface ProfileForm {
  full_name: string;
  phone?: string | null;
  company_name?: string | null;
  city?: string | null;
  address?: string | null;
}

const emptyToNull = (value?: string | null) => (value ? value : null);

/** E-03 Profilim. Telefon, firma ve adres alanları yalnızca müşteri hesaplarında bulunur. */
export function ProfilePage() {
  usePageTitle('Profilim');
  const { user } = useAuth();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<ProfileForm>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;
  const customer = user.customer;

  const onFinish = async (values: ProfileForm) => {
    setError(null);
    setSaving(true);
    const payload = customer
      ? {
          full_name: values.full_name,
          phone: emptyToNull(values.phone),
          company_name: emptyToNull(values.company_name),
          city: emptyToNull(values.city),
          address: emptyToNull(values.address),
        }
      : { full_name: values.full_name };
    try {
      const { data } = await api.patch<CurrentUser>('/auth/me', payload);
      queryClient.setQueryData(ME_QUERY_KEY, data);
      message.success('Bilgileriniz kaydedildi.');
    } catch (err) {
      setError(applyServerErrors(form, err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer title="Profilim" subTitle="Hesap ve iletişim bilgileriniz">
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <Card>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Avatar size={72} style={{ backgroundColor: colors.primary, fontSize: 28 }}>
                {user.full_name.charAt(0).toLocaleUpperCase('tr-TR')}
              </Avatar>
              <Typography.Title level={4} style={{ margin: '12px 0 8px' }}>
                {user.full_name}
              </Typography.Title>
              <RoleTag role={user.role} />
            </div>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="E-posta">{user.email}</Descriptions.Item>
              <Descriptions.Item label="Üyelik tarihi">{formatDate(user.created_at)}</Descriptions.Item>
              <Descriptions.Item label="Son giriş">{formatDateTime(user.last_login_at)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title="Kişisel Bilgiler">
            {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              initialValues={{
                full_name: user.full_name,
                phone: customer?.phone ?? '',
                company_name: customer?.company_name ?? '',
                city: customer?.city ?? '',
                address: customer?.address ?? '',
              }}
              onFinish={onFinish}
              onValuesChange={() => setError(null)}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Ad Soyad"
                    name="full_name"
                    rules={[
                      { required: true, whitespace: true, message: 'Ad soyad zorunludur.' },
                      { min: 2, message: 'Ad soyad en az 2 karakter olmalıdır.' },
                      { max: 100, message: 'Ad soyad en fazla 100 karakter olabilir.' },
                    ]}
                  >
                    <Input autoComplete="name" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="E-posta" extra="E-posta adresi değiştirilemez.">
                    <Input value={user.email} disabled />
                  </Form.Item>
                </Col>
                {customer ? (
                  <>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Telefon"
                        name="phone"
                        rules={[{ max: 30, message: 'Telefon en fazla 30 karakter olabilir.' }]}
                      >
                        <Input autoComplete="tel" placeholder="05xx xxx xx xx" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Firma Adı"
                        name="company_name"
                        rules={[{ max: 150, message: 'Firma adı en fazla 150 karakter olabilir.' }]}
                      >
                        <Input autoComplete="organization" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Şehir"
                        name="city"
                        rules={[{ max: 100, message: 'Şehir en fazla 100 karakter olabilir.' }]}
                      >
                        <Input autoComplete="address-level1" />
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      <Form.Item
                        label="Teslimat Adresi"
                        name="address"
                        rules={[{ max: 1000, message: 'Adres en fazla 1000 karakter olabilir.' }]}
                      >
                        <Input.TextArea rows={3} autoComplete="street-address" />
                      </Form.Item>
                    </Col>
                  </>
                ) : null}
              </Row>
              <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Link to="/profile/password">
                  <Button>Şifre Değiştir</Button>
                </Link>
                <Button type="primary" htmlType="submit" loading={saving}>
                  Kaydet
                </Button>
              </Space>
            </Form>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
}
