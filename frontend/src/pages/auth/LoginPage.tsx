import { Alert, Button, Divider, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { applyServerErrors } from '@/utils/forms';
import { AuthLayout } from './AuthLayout';

interface LoginForm {
  email: string;
  password: string;
}

/** Kayıt ekranından dönüldüğünde gelen bilgi */
export interface LoginLocationState {
  registeredEmail?: string;
}

/** E-01 Giriş. Başarılı girişte yönlendirmeyi PublicOnly koruması yapar. */
export function LoginPage() {
  const { login, sessionExpired } = useAuth();
  const location = useLocation();
  const registeredEmail = (location.state as LoginLocationState | null)?.registeredEmail;
  const [form] = Form.useForm<LoginForm>();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values: LoginForm) => {
    setError(null);
    setSubmitting(true);
    try {
      await login(values.email, values.password);
    } catch (err) {
      setError(applyServerErrors(form, err));
      setSubmitting(false);
    }
  };

  let notice = null;
  if (sessionExpired) {
    notice = (
      <Alert
        type="warning"
        showIcon
        message="Oturumunuzun süresi doldu"
        description="Devam etmek için lütfen tekrar giriş yapın."
        style={{ marginBottom: 16 }}
      />
    );
  } else if (registeredEmail) {
    notice = (
      <Alert
        type="success"
        showIcon
        message="Hesabınız oluşturuldu"
        description="Şimdi giriş yapabilirsiniz."
        style={{ marginBottom: 16 }}
      />
    );
  }

  return (
    <AuthLayout title="Akıllı ERP'ye Giriş" subtitle="Hesabınıza giriş yapın" notice={notice}>
      {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ email: registeredEmail ?? '', password: '' }}
        onFinish={onFinish}
        onValuesChange={() => setError(null)}
      >
        <Form.Item
          label="E-posta"
          name="email"
          rules={[
            { required: true, message: 'E-posta zorunludur.' },
            { type: 'email', message: 'Geçerli bir e-posta adresi girin.' },
          ]}
        >
          <Input autoComplete="email" placeholder="ornek@firma.com" autoFocus={!registeredEmail} />
        </Form.Item>
        <Form.Item label="Şifre" name="password" rules={[{ required: true, message: 'Şifre zorunludur.' }]}>
          <Input.Password autoComplete="current-password" autoFocus={Boolean(registeredEmail)} />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          Giriş Yap
        </Button>
      </Form>
      <Divider style={{ margin: '24px 0 16px' }} />
      <Typography.Paragraph style={{ textAlign: 'center', margin: 0 }}>
        Hesabın yok mu? <Link to="/register">Kayıt Ol</Link>
      </Typography.Paragraph>
    </AuthLayout>
  );
}
