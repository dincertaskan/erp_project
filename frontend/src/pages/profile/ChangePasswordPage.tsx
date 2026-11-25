import { PageContainer } from '@ant-design/pro-components';
import { Alert, App, Button, Card, Form, Input, Space } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { PasswordStrength } from '@/components/PasswordStrength';
import { applyServerErrors } from '@/utils/forms';
import { confirmRules, passwordRules } from '@/utils/password';
import { usePageTitle } from '@/hooks/usePageTitle';

interface PasswordForm {
  current_password: string;
  new_password: string;
  new_password_confirm: string;
}

/** E-04 Şifre Değiştir */
export function ChangePasswordPage() {
  usePageTitle('Şifre Değiştir');
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<PasswordForm>();
  const newPassword = Form.useWatch('new_password', form);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onFinish = async ({ current_password, new_password }: PasswordForm) => {
    setError(null);
    setSaving(true);
    try {
      await api.post('/auth/me/password', { current_password, new_password });
      form.resetFields();
      message.success('Şifreniz güncellendi.');
    } catch (err) {
      setError(applyServerErrors(form, err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer title="Şifre Değiştir" onBack={() => navigate('/profile')}>
      <Card style={{ maxWidth: 520 }}>
        {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={onFinish}
          onValuesChange={() => setError(null)}
        >
          <Form.Item
            label="Mevcut Şifre"
            name="current_password"
            rules={[{ required: true, message: 'Mevcut şifre zorunludur.' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            label="Yeni Şifre"
            name="new_password"
            dependencies={['current_password']}
            rules={[
              ...passwordRules,
              ({ getFieldValue }) => ({
                validator: (_, value: string | undefined) =>
                  value && value === getFieldValue('current_password')
                    ? Promise.reject(new Error('Yeni şifre mevcut şifreyle aynı olamaz.'))
                    : Promise.resolve(),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <PasswordStrength value={newPassword} />
          <Form.Item
            label="Yeni Şifre Tekrarı"
            name="new_password_confirm"
            dependencies={['new_password']}
            rules={confirmRules('new_password')}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => navigate('/profile')}>Vazgeç</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              Şifreyi Güncelle
            </Button>
          </Space>
        </Form>
      </Card>
    </PageContainer>
  );
}
