import { DownOutlined, RightOutlined } from '@ant-design/icons';
import { Badge } from 'antd';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import type { NavGroup } from './navigation';

interface SideNavProps {
  groups: NavGroup[];
  selectedKey?: string;
  criticalCount?: number;
  /** Bir bağlantıya tıklanınca (ör. mobil çekmeceyi kapatmak için) */
  onNavigate?: () => void;
}

/** Gruplu yan menü: her grup beyaz bir kart, başlığı grubu açıp kapatan bir düğme */
export function SideNav({ groups, selectedKey, criticalCount = 0, onNavigate }: SideNavProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const baseId = useId();

  return (
    <nav aria-label="Ana menü" className="side-nav">
      {groups.map((group) => {
        const isCollapsed = Boolean(collapsed[group.key]);
        const bodyId = `${baseId}-${group.key}`;
        return (
          <section key={group.key} className="nav-group">
            <button
              type="button"
              className="nav-group__header"
              aria-expanded={!isCollapsed}
              aria-controls={bodyId}
              onClick={() => setCollapsed((prev) => ({ ...prev, [group.key]: !isCollapsed }))}
            >
              <span>{group.title}</span>
              <DownOutlined className="nav-group__chevron" aria-hidden="true" />
            </button>
            <div id={bodyId} className="nav-group__body" data-collapsed={isCollapsed || undefined}>
              <ul className="nav-group__list">
                {group.items.map((item) => {
                  const active = item.path === selectedKey;
                  const showBadge = item.path === '/stock/critical' && criticalCount > 0;
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        className="nav-item"
                        aria-current={active ? 'page' : undefined}
                        onClick={onNavigate}
                      >
                        <span className="nav-item__icon" aria-hidden="true">
                          {item.icon}
                        </span>
                        <span className="nav-item__label">{item.name}</span>
                        {showBadge ? (
                          <Badge count={criticalCount} size="small" title="Kritik stoktaki ürün sayısı" />
                        ) : null}
                        {active ? <RightOutlined className="nav-item__arrow" aria-hidden="true" /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        );
      })}
    </nav>
  );
}
