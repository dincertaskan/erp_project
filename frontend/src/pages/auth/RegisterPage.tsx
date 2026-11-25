import { Alert, Button, Checkbox, Divider, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { PasswordStrength } from '@/components/PasswordStrength';
import { applyServerErrors } from '@/utils/forms';
import { confirmRules, passwordRules } from '@/utils/password';
import { AuthLayout } from './AuthLayout';
import type { LoginLocationState } from './LoginPage';
import { usePageTitle } from '@/hooks/usePageTitle';

interface RegisterForm {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
  password_confirm: string;
  consent: boolean;
}

/** E-02 Kayıt Ol. Yeni hesaplar her zaman müşteri rolüyle açılır; rol seçimi yoktur. */
export function RegisterPage() {
  usePageTitle('Kayıt Ol');
  const navigate = useNavigate();
  const [form] = Form.useForm<RegisterForm>();
  const password = Form.useWatch('password', form);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async ({ full_name, email, phone, password }: RegisterForm) => {
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/register', { full_name, email, password, phone: phone || null });
      const state: LoginLocationState = { registeredEmail: email.trim().toLowerCase() };
      navigate('/login', { state });
    } catch (err) {
      setError(applyServerErrors(form, err));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Hesap Oluştur" subtitle="Sipariş vermek için ücretsiz hesap açın">
      {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={onFinish}
        onValuesChange={() => setError(null)}
      >
        <Form.Item
          label="Ad Soyad"
          name="full_name"
          rules={[
            { required: true, whitespace: true, message: 'Ad soyad zorunludur.' },
            { min: 2, message: 'Ad soyad en az 2 karakter olmalıdır.' },
            { max: 100, message: 'Ad soyad en fazla 100 karakter olabilir.' },
          ]}
        >
          <Input autoComplete="name" placeholder="Örn: Ahmet Yılmaz" autoFocus />
        </Form.Item>
        <Form.Item
          label="E-posta"
          name="email"
          rules={[
            { required: true, message: 'E-posta zorunludur.' },
            { type: 'email', message: 'Geçerli bir e-posta adresi girin.' },
          ]}
        >
          <Input autoComplete="email" placeholder="ornek@firma.com" />
        </Form.Item>
        <Form.Item
          label="Telefon (isteğe bağlı)"
          name="phone"
          rules={[{ max: 30, message: 'Telefon en fazla 30 karakter olabilir.' }]}
        >
          <Input autoComplete="tel" placeholder="05xx xxx xx xx" />
        </Form.Item>
        <Form.Item label="Şifre" name="password" rules={passwordRules}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <PasswordStrength value={password} />
        <Form.Item
          label="Şifre Tekrarı"
          name="password_confirm"
          dependencies={['password']}
          rules={confirmRules('password')}
        >
          <Input.Password autoComplete="new-password" placeholder="Şifrenizi tekrar giriniz" />
        </Form.Item>
        <Form.Item
          name="consent"
          valuePropName="checked"
          rules={[
            {
              validator: (_, value: boolean) =>
                value ? Promise.resolve() : Promise.reject(new Error('Devam etmek için onay vermelisiniz.')),
            },
          ]}
        >
          <Checkbox>Demo sistem olduğunu biliyorum, gerçek kişisel veri girmeyeceğim.</Checkbox>
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          Hesap Oluştur
        </Button>
      </Form>
      <Divider style={{ margin: '24px 0 16px' }} />
      <Typography.Paragraph style={{ textAlign: 'center', margin: 0 }}>
        Zaten hesabınız var mı? <Link to="/login">Giriş Yap</Link>
      </Typography.Paragraph>
    </AuthLayout>
  );
}
