import { FilterOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Grid,
  Input,
  Pagination,
  Radio,
  Row,
  Select,
  Skeleton,
  Slider,
  Space,
  Switch,
  Typography,
} from 'antd';
import { useState } from 'react';
import { api } from '@/api/client';
import type { CatalogCategory, CatalogPage, CatalogSort } from '@/api/shop';
import { useAuth } from '@/auth/useAuth';
import { formatCurrency } from '@/utils/format';
import { ShopProductCard } from './ShopProductCard';

interface Filters {
  search: string;
  categoryId?: number;
  price?: [number, number];
  inStock: boolean;
  sort: CatalogSort;
  page: number;
}

const PAGE_SIZE = 12;
const initialFilters: Filters = { search: '', inStock: false, sort: 'recommended', page: 1 };

const sortOptions: { value: CatalogSort; label: string }[] = [
  { value: 'recommended', label: 'Önerilen' },
  { value: 'price_asc', label: 'Fiyat (artan)' },
  { value: 'price_desc', label: 'Fiyat (azalan)' },
  { value: 'newest', label: 'En yeni' },
  { value: 'name', label: 'Ada göre' },
];

/** E-30 Ürün Kataloğu */
export function ShopCatalogPage() {
  const { user } = useAuth();
  const screens = Grid.useBreakpoint();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const update = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, page: 1, ...patch }));

  const categories = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: async () => (await api.get<CatalogCategory[]>('/catalog/categories')).data,
  });
  const products = useQuery({
    queryKey: ['catalog', 'products', filters],
    queryFn: async () =>
      (
        await api.get<CatalogPage>('/catalog/products', {
          params: {
            search: filters.search || undefined,
            category_id: filters.categoryId,
            min_price: filters.price?.[0],
            max_price: filters.price?.[1],
            in_stock: filters.inStock || undefined,
            sort: filters.sort,
            page: filters.page,
            page_size: PAGE_SIZE,
          },
        })
      ).data,
    placeholderData: (previous) => previous,
  });

  const minPrice = Math.floor(Number(products.data?.min_price ?? 0));
  const maxPrice = Math.ceil(Number(products.data?.max_price ?? 0));
  const filtered =
    filters.search !== '' || filters.categoryId !== undefined || filters.price !== undefined || filters.inStock;

  const filterPanel = (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <div>
        <Typography.Text strong>Kategoriler</Typography.Text>
        <Radio.Group
          style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}
          value={filters.categoryId ?? 'all'}
          onChange={(event) =>
            update({ categoryId: event.target.value === 'all' ? undefined : event.target.value, price: undefined })
          }
        >
          <Radio value="all">Tümü</Radio>
          {(categories.data ?? []).map((category) => (
            <Radio key={category.id} value={category.id}>
              {category.name} <Typography.Text type="secondary">({category.product_count})</Typography.Text>
            </Radio>
          ))}
        </Radio.Group>
      </div>
      {maxPrice > minPrice ? (
        <div>
          <Typography.Text strong>Fiyat Aralığı</Typography.Text>
          <Slider
            range
            min={minPrice}
            max={maxPrice}
            value={filters.price ?? [minPrice, maxPrice]}
            onChangeComplete={(value) => update({ price: value as [number, number] })}
            tooltip={{ formatter: (value) => formatCurrency(value ?? 0) }}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {formatCurrency(filters.price?.[0] ?? minPrice)} – {formatCurrency(filters.price?.[1] ?? maxPrice)}
          </Typography.Text>
        </div>
      ) : null}
      <Space>
        <Switch
          checked={filters.inStock}
          onChange={(inStock) => update({ inStock })}
          aria-label="Yalnızca stokta olanlar"
        />
        <Typography.Text>Yalnızca stokta olanlar</Typography.Text>
      </Space>
      {filtered ? (
        <Button block onClick={() => setFilters(initialFilters)}>
          Filtreleri Temizle
        </Button>
      ) : null}
    </Space>
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Ürünler
        </Typography.Title>
        <Typography.Text type="secondary">Hoş geldin, {user?.full_name.split(' ')[0]}.</Typography.Text>
      </div>

      <Row gutter={24}>
        {screens.lg ? (
          <Col lg={6}>
            <Card>{filterPanel}</Card>
          </Col>
        ) : null}
        <Col xs={24} lg={18}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space wrap>
                {screens.lg ? null : (
                  <Button icon={<FilterOutlined />} onClick={() => setDrawerOpen(true)}>
                    Filtrele
                  </Button>
                )}
                <Input.Search
                  allowClear
                  placeholder="Ürün ara"
                  style={{ width: 240 }}
                  onSearch={(search) => update({ search: search.trim() })}
                />
                <Typography.Text type="secondary">{products.data?.total ?? 0} ürün</Typography.Text>
              </Space>
              <Select
                value={filters.sort}
                options={sortOptions}
                style={{ width: 170 }}
                onChange={(sort) => update({ sort })}
                aria-label="Sıralama"
              />
            </Space>

            {products.isError ? (
              <Alert type="error" showIcon message="Ürünler yüklenemedi, tekrar deneyin." />
            ) : products.isPending ? (
              <Row gutter={[16, 16]}>
                {Array.from({ length: 8 }, (_, index) => (
                  <Col key={index} xs={24} sm={12} xl={8}>
                    <Card>
                      <Skeleton active />
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : products.data.items.length === 0 ? (
              <Card>
                <Empty description="Aramanıza uygun ürün bulunamadı.">
                  {filtered ? <Button onClick={() => setFilters(initialFilters)}>Filtreleri Temizle</Button> : null}
                </Empty>
              </Card>
            ) : (
              <>
                <Row gutter={[16, 16]}>
                  {products.data.items.map((product) => (
                    <Col key={product.id} xs={24} sm={12} xl={8}>
                      <ShopProductCard product={product} />
                    </Col>
                  ))}
                </Row>
                <Pagination
                  align="center"
                  current={filters.page}
                  pageSize={PAGE_SIZE}
                  total={products.data.total}
                  showSizeChanger={false}
                  onChange={(page) => setFilters((current) => ({ ...current, page }))}
                />
              </>
            )}
          </Space>
        </Col>
      </Row>

      <Drawer title="Filtrele" placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {filterPanel}
      </Drawer>
    </Space>
  );
}
