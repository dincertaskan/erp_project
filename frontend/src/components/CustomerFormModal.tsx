import { ModalForm, ProFormSwitch, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Col, Row } from 'antd';
import type { FormInstance } from 'antd';
import { useRef } from 'react';
import { api, errorMessage } from '@/api/client';
import type { CustomerDetail, CustomerListItem } from '@/api/customers';
import { applyServerErrors } from '@/utils/forms';

interface CustomerForm {
  full_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  city?: string;
  address?: string;
  is_active: boolean;
}

interface CustomerFormModalProps {
  open: boolean;
  /** Düzenlenecek müşteri; yoksa yeni müşteri eklenir */
  customer: CustomerListItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (customer: CustomerDetail) => void;
}

/** E-23 Müşteri Ekle/Düzenle. Giriş hesabı olan müşterinin e-postası değiştirilemez. */
export function CustomerFormModal({ open, customer, onOpenChange, onSaved }: CustomerFormModalProps) {
  const { message } = App.useApp();
  const formRef = useRef<FormInstance<CustomerForm>>(null);
  const emailLocked = Boolean(customer?.has_account);

  const onFinish = async (values: CustomerForm) => {
    const payload = {
      full_name: values.full_name,
      email: values.email,
      phone: values.phone || null,
      company_name: values.company_name || null,
      city: values.city || null,
      address: values.address || null,
      is_active: values.is_active,
    };
    try {
      const { data } = customer
        ? await api.put<CustomerDetail>(`/customers/${customer.id}`, payload)
        : await api.post<CustomerDetail>('/customers', payload);
      message.success('Müşteri kaydedildi.');
      onSaved(data);
      return true;
    } catch (err) {
      const general = formRef.current ? applyServerErrors(formRef.current, err) : errorMessage(err);
      if (general) message.error(general);
      return false;
    }
  };

  return (
    <ModalForm<CustomerForm>
      title={customer ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'}
      open={open}
      width={640}
      formRef={formRef}
      modalProps={{ destroyOnHidden: true }}
      submitter={{ searchConfig: { submitText: 'Kaydet', resetText: 'İptal' } }}
      initialValues={
        customer
          ? {
              full_name: customer.full_name,
              email: customer.email,
              phone: customer.phone ?? '',
              company_name: customer.company_name ?? '',
              city: customer.city ?? '',
              address: customer.address ?? '',
              is_active: customer.is_active,
            }
          : { is_active: true }
      }
      onOpenChange={onOpenChange}
      onFinish={onFinish}
    >
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <ProFormText
            name="full_name"
            label="Ad Soyad"
            placeholder="Örn: Ahmet Yılmaz"
            rules={[
              { required: true, whitespace: true, message: 'Ad soyad zorunludur.' },
              { min: 2, message: 'Ad soyad en az 2 karakter olmalıdır.' },
              { max: 150, message: 'Ad soyad en fazla 150 karakter olabilir.' },
            ]}
          />
        </Col>
        <Col xs={24} md={12}>
          <ProFormText
            name="email"
            label="E-posta"
            placeholder="ornek@firma.com"
            disabled={emailLocked}
            extra={emailLocked ? 'Müşterinin giriş hesabı olduğu için değiştirilemez.' : undefined}
            rules={[
              { required: true, message: 'E-posta zorunludur.' },
              { type: 'email', message: 'Geçerli bir e-posta adresi girin.' },
            ]}
          />
        </Col>
        <Col xs={24} md={12}>
          <ProFormText
            name="phone"
            label="Telefon"
            placeholder="05xx xxx xx xx"
            rules={[{ max: 30, message: 'Telefon en fazla 30 karakter olabilir.' }]}
          />
        </Col>
        <Col xs={24} md={12}>
          <ProFormText
            name="company_name"
            label="Firma Adı"
            placeholder=""
            rules={[{ max: 150, message: 'Firma adı en fazla 150 karakter olabilir.' }]}
          />
        </Col>
        <Col xs={24} md={12}>
          <ProFormText
            name="city"
            label="Şehir"
            placeholder=""
            rules={[{ max: 100, message: 'Şehir en fazla 100 karakter olabilir.' }]}
          />
        </Col>
        <Col xs={24} md={12}>
          <ProFormSwitch name="is_active" label="Aktif" />
        </Col>
        <Col span={24}>
          <ProFormTextArea
            name="address"
            label="Adres"
            placeholder=""
            fieldProps={{ rows: 2 }}
            rules={[{ max: 1000, message: 'Adres en fazla 1000 karakter olabilir.' }]}
          />
        </Col>
      </Row>
    </ModalForm>
  );
}
