from app.repositories.dashboard_repository import DashboardRepository

class DashboardService:
    def __init__(self, dashboard_repo: DashboardRepository):
        self.repo = dashboard_repo

    def get_dashboard_summary(self):
        total_stock = self.repo.get_total_stock()
        total_revenue = self.repo.get_total_revenue()
        active_customers = self.repo.get_active_users_count()
        critical_products = self.repo.get_critical_products()

        # Kategorilere göre stok dağılımı
        category_stats = self.repo.get_category_distribution()
        category_data = [{"name": c.name, "value": c.value, "color": c.color} for c in category_stats]

        # Aylara göre satış trendi
        sales_by_month = self.repo.get_sales_by_month()
        month_names = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Ekim", "Kas", "Ara"]
        sales_data = [
            {
                "month": month_names[int(m.month_num) - 1], 
                "ciro": float(m.ciro) if m.ciro is not None else 0.0 # <--- Sayıya dönüştürüldü
            } 
            for m in sales_by_month
        ]

        # Kritik stok listesi
        critical_stock_list = [
            {
                "id": p.id,
                "name": p.name,
                "category": p.category.name if p.category else "Genel",
                "stock": p.stock,
                "min_stock": p.min_stock
            }
            for p in critical_products
        ]

        return {
            "total_stock": total_stock,
            "monthly_sales_total": total_revenue,
            "active_customers": active_customers,
            "critical_stock_count": len(critical_products),
            "sales_data": sales_data,
            "category_data": category_data,
            "critical_stock": critical_stock_list,
            "recent_activities": []
        }